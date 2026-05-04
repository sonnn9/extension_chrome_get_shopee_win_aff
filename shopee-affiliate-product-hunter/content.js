/* =========================================================
 * Shopee Affiliate Product Hunter — content.js
 * ---------------------------------------------------------
 * Chạy trên tab Shopee. Khi popup gửi message SAPTH_SCAN,
 * quét DOM hiển thị, tìm các block sản phẩm và trích xuất:
 *   product_name, price, sold_count, rating, review_count,
 *   shop_name, product_url
 *
 * Logic được viết linh hoạt để chống thay đổi class:
 *  - Tìm các <a href> chứa "/product/" hoặc "-i.<shopId>.<itemId>"
 *  - Lấy text trong block cha gần nhất, suy luận các field
 *  - Nếu là trang sản phẩm đơn → đọc thông tin trên trang đó
 * ========================================================= */

(() => {
  // Tránh inject 2 listener khi script bị nạp lại
  if (window.__SAPTH_CONTENT_LOADED__) return;
  window.__SAPTH_CONTENT_LOADED__ = true;

  // ---------------- Helpers parse text -------------------

  // "1,2k", "12.3k", "5.4k đã bán", "1k+", "12000" → number
  function parseCount(text) {
    if (!text) return null;
    const t = String(text).toLowerCase().replace(/\s+/g, "");
    const m = t.match(/([\d.,]+)(k|tr|m)?/);
    if (!m) return null;
    let num = parseFloat(m[1].replace(",", "."));
    if (isNaN(num)) return null;
    const unit = m[2];
    if (unit === "k") num *= 1000;
    else if (unit === "tr" || unit === "m") num *= 1000000;
    return Math.round(num);
  }

  // "₫129.000", "129.000₫", "129,000 - 199,000" → 129000 (lấy giá thấp nhất)
  function parsePrice(text) {
    if (!text) return null;
    const cleaned = String(text).replace(/[^\d.,\-]/g, " ");
    const matches = cleaned.match(/[\d.,]+/g);
    if (!matches) return null;
    const nums = matches
      .map(s => parseInt(s.replace(/[.,]/g, ""), 10))
      .filter(n => !isNaN(n) && n >= 1000 && n < 1_000_000_000);
    if (nums.length === 0) return null;
    return Math.min(...nums);
  }

  // Rating có thể là "4.8" hoặc số sao đếm từ icon → trả về float
  function parseRating(text) {
    if (!text) return null;
    const m = String(text).match(/(\d(?:[.,]\d+)?)/);
    if (!m) return null;
    const v = parseFloat(m[1].replace(",", "."));
    if (isNaN(v) || v < 0 || v > 5) return null;
    return Math.round(v * 10) / 10;
  }

  // ---------------- URL identification -------------------

  function isShopeeProductHref(href) {
    if (!href) return false;
    // Dạng: /<slug>-i.<shopId>.<itemId> hoặc /product/<shopId>/<itemId>
    return /-i\.\d+\.\d+/.test(href) || /\/product\/\d+\/\d+/.test(href);
  }

  function absoluteUrl(href) {
    try { return new URL(href, location.origin).toString().split("?")[0]; }
    catch { return href; }
  }

  // ---------------- Block product extractor --------------

  // Tìm "card cha" gần nhất chứa link sản phẩm
  function findCardContainer(linkEl) {
    let node = linkEl;
    let bestArea = 0;
    let best = linkEl;
    for (let i = 0; i < 6 && node && node !== document.body; i++) {
      node = node.parentElement;
      if (!node) break;
      const rect = node.getBoundingClientRect();
      const area = rect.width * rect.height;
      // Stop sớm khi parent quá lớn (cả grid)
      if (area > 1_500_000) break;
      if (area > bestArea && rect.width > 100 && rect.height > 100) {
        bestArea = area;
        best = node;
      }
    }
    return best;
  }

  function extractFromCard(card, link) {
    const text = (card.innerText || "").replace(/ /g, " ");
    const lines = text.split("\n").map(s => s.trim()).filter(Boolean);

    // product_name: ưu tiên alt của img trong link, hoặc dòng dài nhất không phải giá
    let name = null;
    const img = card.querySelector("img[alt]");
    if (img && img.alt && img.alt.trim().length > 5) {
      name = img.alt.trim();
    }
    if (!name) {
      // chọn dòng dài nhất, loại bỏ dòng có ký tự ₫ hoặc "đã bán"
      const candidates = lines.filter(l =>
        !/₫|đ\b|đã bán|sold|^\d+([.,]\d+)?$|^k\+?$/i.test(l) &&
        l.length >= 8 && l.length <= 200
      );
      candidates.sort((a, b) => b.length - a.length);
      if (candidates[0]) name = candidates[0];
    }

    // price: tìm dòng có ₫
    let price = null;
    const priceLine = lines.find(l => /₫|VND/i.test(l));
    if (priceLine) price = parsePrice(priceLine);
    if (price == null) {
      // Thử dòng kế bên có dạng số thuần lớn
      const numLine = lines.find(l => /^\d{1,3}([.,]\d{3})+$/.test(l));
      if (numLine) price = parsePrice(numLine);
    }

    // sold_count: dòng có "đã bán" hoặc "sold"
    let sold = null;
    const soldLine = lines.find(l => /đã bán|sold/i.test(l));
    if (soldLine) sold = parseCount(soldLine);

    // rating: tìm node có aria-label "rating" hoặc dòng dạng "4.8" gần text "đã bán"
    let rating = null;
    const ratingNode = card.querySelector('[class*="rating" i], [class*="star" i], [aria-label*="rating" i]');
    if (ratingNode) rating = parseRating(ratingNode.getAttribute("aria-label") || ratingNode.innerText);
    if (rating == null) {
      // Heuristic: dòng đứng riêng dạng "4.8" không phải giá
      const rl = lines.find(l => /^\d(\.\d)?$/.test(l));
      if (rl) rating = parseRating(rl);
    }

    // review_count: dòng có "(123)" hoặc "Đánh giá"
    let reviews = null;
    const revLine = lines.find(l => /\(\s*\d[\d.,k]*\s*\)/i.test(l) || /đánh giá|review/i.test(l));
    if (revLine) {
      const m = revLine.match(/\(\s*([\d.,k+]+)\s*\)/i) || revLine.match(/([\d.,k+]+)\s*(đánh giá|review)/i);
      if (m) reviews = parseCount(m[1]);
    }

    // shop_name: thường khó lấy ở grid; thử các selector phổ biến
    let shop = null;
    const shopNode = card.querySelector('[class*="shop" i] [class*="name" i], [class*="seller" i]');
    if (shopNode && shopNode.innerText && shopNode.innerText.trim().length < 60) {
      shop = shopNode.innerText.trim();
    }

    return {
      product_name: name || null,
      price: price,
      sold_count: sold,
      rating: rating,
      review_count: reviews,
      shop_name: shop,
      product_url: absoluteUrl(link.getAttribute("href")),
    };
  }

  // ---------------- Single product page ------------------

  function isProductPage() {
    return /-i\.\d+\.\d+/.test(location.pathname) || /\/product\/\d+\/\d+/.test(location.pathname);
  }

  function extractSinglePage() {
    const text = document.body.innerText.replace(/ /g, " ");
    const lines = text.split("\n").map(s => s.trim()).filter(Boolean);

    // name: <h1> đầu tiên hoặc <title>
    let name = null;
    const h1 = document.querySelector("h1");
    if (h1 && h1.innerText.trim().length > 4) name = h1.innerText.trim();
    if (!name && document.title) name = document.title.split("|")[0].trim();

    // price: dòng có ký hiệu ₫ đầu tiên
    let price = null;
    const priceLine = lines.find(l => /₫|VND/i.test(l));
    if (priceLine) price = parsePrice(priceLine);

    // sold
    let sold = null;
    const soldLine = lines.find(l => /đã bán|sold/i.test(l));
    if (soldLine) sold = parseCount(soldLine);

    // rating
    let rating = null;
    const rl = lines.find(l => /^\d\.\d$/.test(l));
    if (rl) rating = parseRating(rl);

    // reviews
    let reviews = null;
    const revLine = lines.find(l => /đánh giá|review/i.test(l));
    if (revLine) {
      const m = revLine.match(/([\d.,k]+)\s*(đánh giá|review)/i);
      if (m) reviews = parseCount(m[1]);
    }

    // shop name
    let shop = null;
    const shopNode = document.querySelector('[class*="shop" i] [class*="name" i], a[href*="/shop/"], a[href*=".shopee."]');
    if (shopNode) {
      const t = shopNode.innerText && shopNode.innerText.trim();
      if (t && t.length < 60) shop = t;
    }

    return [{
      product_name: name || null,
      price,
      sold_count: sold,
      rating,
      review_count: reviews,
      shop_name: shop,
      product_url: absoluteUrl(location.pathname),
    }];
  }

  // ---------------- Listing page extractor ---------------

  function extractListingPage() {
    const links = Array.from(document.querySelectorAll("a[href]"))
      .filter(a => isShopeeProductHref(a.getAttribute("href")));

    // Dedupe theo URL & lấy link đại diện đầu tiên cho mỗi sản phẩm
    const seen = new Map();
    for (const a of links) {
      const url = absoluteUrl(a.getAttribute("href"));
      if (!seen.has(url)) seen.set(url, a);
    }

    const results = [];
    for (const [url, link] of seen.entries()) {
      try {
        const card = findCardContainer(link);
        const data = extractFromCard(card, link);
        // Bỏ qua nếu hoàn toàn không có name & price
        if (!data.product_name && data.price == null) continue;
        results.push(data);
      } catch (e) {
        // Không crash extension
        console.warn("[SAPTH] extract error:", e);
      }
    }
    return results;
  }

  // ---------------- Message handler ----------------------

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "SAPTH_SCAN") return false;
    try {
      const products = isProductPage() ? extractSinglePage() : extractListingPage();
      sendResponse({ ok: true, products });
    } catch (e) {
      console.error("[SAPTH] scan error:", e);
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
    return true; // keep channel open for sync sendResponse
  });
})();
