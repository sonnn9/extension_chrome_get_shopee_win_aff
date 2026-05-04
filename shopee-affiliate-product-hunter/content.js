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
    // sold_recent: ưu tiên các badge "đã bán X trong tháng / gần đây / 30 ngày"
    let sold = null;
    let soldRecent = null;
    const recentLine = lines.find(l => /đã bán[^.\n]*?(trong tháng|tháng này|gần đây|30 ngày|tuần này)/i.test(l));
    if (recentLine) soldRecent = parseCount(recentLine);
    const soldLine = lines.find(l => /đã bán|sold/i.test(l) && l !== recentLine);
    if (soldLine) sold = parseCount(soldLine);
    // Nếu chỉ có 1 dòng "đã bán ..." chung chung, vẫn dùng làm sold tổng
    if (sold == null && recentLine) sold = parseCount(recentLine);

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
      sold_recent: soldRecent,
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

    // sold + sold_recent
    let sold = null;
    let soldRecent = null;
    const recentLine = lines.find(l => /đã bán[^.\n]*?(trong tháng|tháng này|gần đây|30 ngày|tuần này)/i.test(l));
    if (recentLine) soldRecent = parseCount(recentLine);
    const soldLine = lines.find(l => /đã bán|sold/i.test(l) && l !== recentLine);
    if (soldLine) sold = parseCount(soldLine);
    if (sold == null && recentLine) sold = parseCount(recentLine);

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
      sold_recent: soldRecent,
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

  // ---------------- Image extractor (cho Downloader) ----------------

  // Shopee CDN URL pattern: https://<sub>.img.susercontent.com/file/<HASH>
  // hoặc https://cf.shopee.vn/file/<HASH>. HASH có thể là 32 hex hoặc namespace-slug.
  const SHOPEE_CDN_HOST = "https://down-vn.img.susercontent.com/file/";

  function normalizeHash(raw) {
    // Bỏ suffix kích thước "_tn" hoặc đuôi extension
    return String(raw).replace(/_tn$/i, "").replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");
  }

  // Tìm container gallery: Shopee bố trí gallery + info-h1 trong cùng 1 flex/grid.
  // Walk up từ <h1> đến tổ tiên có display:flex/grid → tìm sibling KHÔNG chứa h1
  // mà chứa nhiều <img> → đó chính là gallery panel (ảnh chính + carousel thumbnail).
  function findGalleryContainer() {
    const h1 = document.querySelector("h1");
    if (!h1) return null;

    let node = h1;
    for (let i = 0; i < 12 && node && node !== document.body; i++) {
      const parent = node.parentElement;
      if (!parent) break;
      const style = window.getComputedStyle(parent);
      if (style.display === "flex" || style.display === "grid") {
        // Trong các con của parent: chọn sibling không chứa h1 mà có nhiều img nhất
        let bestSib = null, bestCount = 0;
        for (const sib of parent.children) {
          if (sib === node || sib.contains(h1)) continue;
          const count = sib.querySelectorAll("img").length;
          if (count > bestCount) { bestCount = count; bestSib = sib; }
        }
        if (bestSib && bestCount >= 2) return bestSib;
      }
      node = parent;
    }
    return null;
  }

  // Đọc URL ảnh từ <meta og:image> + JSON-LD (Product.image). Đây là 2 nguồn
  // chính thức của Shopee — luôn đúng, không lẫn ảnh review/recommended.
  function harvestFromMetadata() {
    const out = [];
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(meta => {
      const c = meta.getAttribute("content");
      if (!c) return;
      const mm = c.match(/file\/([^\s"'<>?#)\\]+)/);
      out.push(mm ? normalizeHash(mm[1]) : c);
    });
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const data = JSON.parse(s.textContent || "{}");
        // Chỉ quan tâm Product.image — bỏ qua field image khác (Review.author.image, …)
        const stack = Array.isArray(data) ? [...data] : [data];
        while (stack.length) {
          const cur = stack.shift();
          if (!cur || typeof cur !== "object") continue;
          if (cur["@type"] === "Product" && cur.image) {
            const imgs = Array.isArray(cur.image) ? cur.image : [cur.image];
            imgs.forEach(u => {
              if (typeof u !== "string") return;
              const mm = u.match(/file\/([^\s"'<>?#)\\]+)/);
              out.push(mm ? normalizeHash(mm[1]) : u);
            });
          }
          // Đào tiếp các nested object nhưng KHÔNG follow vào Review/UserComments
          for (const [k, v] of Object.entries(cur)) {
            if (/review|comment|author/i.test(k)) continue;
            if (v && typeof v === "object") stack.push(v);
          }
        }
      } catch (_) {}
    });
    return out;
  }

  // CHỈ đọc ảnh trong gallery container. Bỏ avatar review, recommended, banner.
  function harvestFromGalleryDom() {
    const out = [];
    const root = findGalleryContainer();
    if (!root) return out;

    const collect = (u) => {
      if (!u) return;
      const mm = String(u).match(/file\/([^\s"'<>?#)\\]+)/);
      if (mm) out.push(normalizeHash(mm[1]));
    };

    root.querySelectorAll("img").forEach(img => {
      collect(img.currentSrc);
      collect(img.src);
      collect(img.getAttribute("data-src"));
      collect(img.getAttribute("data-original"));
      collect(img.getAttribute("data-lazy-src"));
      collect(img.getAttribute("data-image"));
      if (img.srcset) {
        img.srcset.split(",").forEach(e => collect(e.trim().split(/\s+/)[0]));
      }
    });

    // background-image trong gallery (Shopee đôi khi dùng div + bg)
    root.querySelectorAll("[style*='background']").forEach(node => {
      const s = node.getAttribute("style") || "";
      const re = /url\(["']?([^"')]+)["']?\)/gi;
      let m;
      while ((m = re.exec(s)) !== null) collect(m[1]);
    });

    return out;
  }

  // Force trigger lazy-load: scroll xuống/lên + chờ
  async function triggerLazyLoad() {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const originalY = window.scrollY;
    const steps = [0, 300, 700, 1200, 1800, 0];
    for (const y of steps) {
      window.scrollTo({ top: y, behavior: "instant" in window ? "instant" : "auto" });
      await sleep(350);
    }
    window.scrollTo({ top: originalY, behavior: "instant" in window ? "instant" : "auto" });
    await sleep(400);
  }

  function buildCdnUrl(hash) {
    // Nếu hash đã là URL đầy đủ (fallback từ og:image không match pattern), trả về thẳng
    if (/^https?:\/\//.test(hash)) return hash;
    return SHOPEE_CDN_HOST + hash;
  }

  // Trả về danh sách URL ảnh: ưu tiên og:image + JSON-LD (Product.image), kế tiếp
  // là ảnh trong gallery container. KHÔNG đọc toàn DOM/HTML để tránh dính ảnh
  // review (avatar, ảnh user upload), recommended, banner.
  async function extractProductImages() {
    await triggerLazyLoad();

    const fromMeta    = harvestFromMetadata();
    const fromGallery = harvestFromGalleryDom();

    const ordered = [];
    const seen = new Set();
    function pushAll(arr) {
      for (const h of arr) {
        if (!h || seen.has(h)) continue;
        if (/icon|logo|avatar|sprite|placeholder/i.test(h)) continue;
        seen.add(h);
        ordered.push(h);
      }
    }
    pushAll(fromMeta);
    pushAll(fromGallery);

    // Cap an toàn: gallery Shopee tối đa ~9 ảnh; >12 chắc chắn lẫn rác
    return ordered.slice(0, 12).map(buildCdnUrl);
  }

  async function extractProductInfo() {
    const single = extractSinglePage()[0] || {};
    const images = await extractProductImages();
    return {
      product_name: single.product_name || (document.title.split("|")[0].trim() || null),
      product_url: absoluteUrl(location.pathname + location.search),
      shop_name: single.shop_name || null,
      price: single.price || null,
      image_urls: images,
    };
  }

  // ---------------- Message handler ----------------------

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return false;

    if (msg.type === "SAPTH_SCAN") {
      try {
        const products = isProductPage() ? extractSinglePage() : extractListingPage();
        sendResponse({ ok: true, products });
      } catch (e) {
        console.error("[SAPTH] scan error:", e);
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
      return true;
    }

    if (msg.type === "SAPTH_EXTRACT_IMAGES") {
      // async: sendResponse cần được giữ channel mở → return true
      extractProductInfo()
        .then(info => sendResponse({ ok: true, info }))
        .catch(e => {
          console.error("[SAPTH] extract images error:", e);
          sendResponse({ ok: false, error: String(e && e.message || e) });
        });
      return true;
    }

    return false;
  });
})();
