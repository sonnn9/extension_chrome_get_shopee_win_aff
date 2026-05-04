/* =========================================================
 * Shopee Affiliate Product Hunter — popup.js
 * ---------------------------------------------------------
 * - Gửi message yêu cầu content.js scan trang Shopee hiện tại
 * - Nhận danh sách raw products → chấm điểm → render UI
 * - Lưu/đọc chrome.storage.local, dedupe theo product_url
 * - Export CSV (UTF-8 BOM để Excel hiểu tiếng Việt)
 * ========================================================= */

const STORAGE_KEY = "sapth_products";

const el = {
  btnScan:    document.getElementById("btnScan"),
  btnExport:  document.getElementById("btnExport"),
  btnClear:   document.getElementById("btnClear"),
  status:     document.getElementById("status"),
  statCount:  document.getElementById("statCount"),
  statTop:    document.getElementById("statTop"),
  statAvg:    document.getElementById("statAvg"),
  list:       document.getElementById("productList"),
  search:     document.getElementById("searchBox"),
  labelFilt:  document.getElementById("labelFilter"),
};

// ----------------------- UI helpers -----------------------
function showStatus(msg, type = "info", autoHideMs = 0) {
  el.status.className = `status ${type}`;
  el.status.innerHTML = msg;
  if (autoHideMs > 0) {
    setTimeout(() => el.status.classList.add("hidden"), autoHideMs);
  }
}
function hideStatus() { el.status.classList.add("hidden"); }

function setScanning(scanning) {
  el.btnScan.disabled = scanning;
  el.btnScan.innerHTML = scanning
    ? '<span class="spinner"></span>Đang scan...'
    : '🔍 Scan Current Page';
}

// ----------------------- Scoring --------------------------
const CATEGORY_KEYWORDS = {
  "gia dụng thông minh": ["thông minh","tự động","cảm biến","đa năng","tiện ích","máy hút","robot","cắt","gọt","ép"],
  "mẹ và bé":            ["bé","sơ sinh","trẻ em","bỉm","ti giả","bình sữa","đồ chơi","mầm non","mẹ"],
  "học sinh / văn phòng phẩm": ["bút","sổ","tập","vở","học sinh","học tập","văn phòng phẩm","máy tính","kẹp","ghim","học"],
  "làm đẹp":             ["son","kem","mặt nạ","tẩy","serum","dưỡng","trang điểm","mascara","phấn","chống nắng","mỹ phẩm"],
  "phụ kiện điện thoại": ["ốp","cáp","sạc","tai nghe","airpod","giá đỡ","pin dự phòng","cường lực","điện thoại"],
  "đồ bếp":              ["bếp","nồi","chảo","dao","thớt","khay","muỗng","đũa","ly","ấm","đồ bếp"],
  "đồ decor":            ["decor","trang trí","đèn","khung","tranh","cây giả","gối","thảm","kệ"],
  "đồ tiện ích":         ["tiện ích","đa năng","gọn nhẹ","mini","tiết kiệm","tiện lợi"],
};

const RISK_KEYWORDS = [
  "giảm cân","tăng cân","tăng cơ","trắng da cấp tốc","trị mụn dứt điểm","cam kết 100%","chữa khỏi","thần dược",
  "tăng kích thước","sex","18+","vape","thuốc lá","cá độ","kích dục","hàng nhái","fake","replica"
];

function scoreFromBuckets(value, buckets) {
  // buckets: [[max, score], ...] - giá trị thuộc bucket nào thì lấy score đó
  for (const [max, score] of buckets) {
    if (value <= max) return score;
  }
  return buckets[buckets.length - 1][1];
}

function calculateAffiliateScore(p) {
  let total = 0;
  const breakdown = {};

  // 1) Sales (max 25)
  const sold = Number(p.sold_count) || 0;
  let salesScore;
  if (sold >= 2000)      salesScore = 25;
  else if (sold >= 500)  salesScore = 20;
  else if (sold >= 50)   salesScore = 12;
  else if (sold > 0)     salesScore = 6;
  else                   salesScore = 0;
  breakdown.sales = salesScore;
  total += salesScore;

  // 2) Rating (max 20)
  const rating = Number(p.rating) || 0;
  let ratingScore = 0;
  if (rating >= 4.8)        ratingScore = 20;
  else if (rating >= 4.6)   ratingScore = 16;
  else if (rating >= 4.3)   ratingScore = 10;
  else if (rating > 0)      ratingScore = 4;
  breakdown.rating = ratingScore;
  total += ratingScore;

  // 3) Review count (max 15) — log-ish
  const reviews = Number(p.review_count) || 0;
  let reviewScore = 0;
  if (reviews >= 1000)      reviewScore = 15;
  else if (reviews >= 300)  reviewScore = 12;
  else if (reviews >= 100)  reviewScore = 9;
  else if (reviews >= 30)   reviewScore = 6;
  else if (reviews > 0)     reviewScore = 3;
  breakdown.reviews = reviewScore;
  total += reviewScore;

  // 4) Price (max 15) — sweet spot 99k–499k
  const price = Number(p.price) || 0;
  let priceScore = 0;
  if (price >= 99000 && price <= 499000)        priceScore = 15;
  else if (price >= 50000 && price < 99000)     priceScore = 11;
  else if (price > 499000 && price <= 900000)   priceScore = 8;
  else if (price > 0 && price < 50000)          priceScore = 5;
  else if (price > 900000)                      priceScore = 3;
  breakdown.price = priceScore;
  total += priceScore;

  // 5) Content potential (max 15) — keyword theo nhóm
  const name = (p.product_name || "").toLowerCase();
  let matchedCategory = null;
  let contentScore = 0;
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some(w => name.includes(w))) {
      matchedCategory = cat;
      contentScore = 15;
      break;
    }
  }
  if (!matchedCategory && name.length > 0) contentScore = 5; // có tên nhưng không match
  breakdown.content = contentScore;
  total += contentScore;

  // 6) Risk penalty (max -10)
  let penalty = 0;
  if (RISK_KEYWORDS.some(w => name.includes(w))) penalty += 6;
  if (rating > 0 && rating < 4.0)                penalty += 2;
  if (sold > 0 && sold < 10)                     penalty += 2;
  penalty = Math.min(penalty, 10);
  breakdown.penalty = -penalty;
  total -= penalty;

  total = Math.max(0, Math.min(100, Math.round(total)));

  let label;
  if (total >= 80)      label = "Rất nên làm";
  else if (total >= 65) label = "Có tiềm năng";
  else if (total >= 50) label = "Cần cân nhắc";
  else                  label = "Bỏ qua";

  return { score: total, label, breakdown, matchedCategory };
}

function generateContentAngle(p, matchedCategory) {
  const angleByCat = {
    "đồ bếp": "Video problem-solution: căn bếp gọn hơn chỉ với món này.",
    "mẹ và bé": "Review thực tế cho mẹ bỉm: có đáng mua không?",
    "học sinh / văn phòng phẩm": "Back-to-school item nên có trong cặp.",
    "làm đẹp": "Test nhanh trước/sau trong 15 giây.",
    "gia dụng thông minh": "Một món đồ nhỏ giúp tiết kiệm thời gian mỗi ngày.",
    "phụ kiện điện thoại": "Phụ kiện đáng sắm dưới 200k cho điện thoại của bạn.",
    "đồ decor": "Biến góc phòng buồn tẻ thành góc sống ảo trong 30 giây.",
    "đồ tiện ích": "Mẹo nhỏ — món đồ tí hon giải quyết vấn đề hằng ngày.",
  };
  if (matchedCategory && angleByCat[matchedCategory]) return angleByCat[matchedCategory];
  return "Review trải nghiệm thật + nêu 3 lý do nên mua.";
}

function labelClass(label) {
  switch (label) {
    case "Rất nên làm":   return "label label-good";
    case "Có tiềm năng":  return "label label-potential";
    case "Cần cân nhắc":  return "label label-consider";
    default:              return "label label-skip";
  }
}

// ----------------------- Storage --------------------------
async function loadStored() {
  const obj = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(obj[STORAGE_KEY]) ? obj[STORAGE_KEY] : [];
}
async function saveStored(list) {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

function mergeProducts(existing, incoming) {
  const map = new Map();
  for (const p of existing) map.set(p.product_url, p);
  for (const p of incoming) {
    const prev = map.get(p.product_url);
    map.set(p.product_url, prev ? { ...prev, ...p } : p);
  }
  return Array.from(map.values());
}

// ----------------------- Render ---------------------------
function renderList(products) {
  const q = (el.search.value || "").toLowerCase().trim();
  const lf = el.labelFilt.value;

  const filtered = products.filter(p => {
    const okName  = !q || (p.product_name || "").toLowerCase().includes(q);
    const okLabel = lf === "all" || p.label === lf;
    return okName && okLabel;
  });

  // Sort by score desc
  filtered.sort((a, b) => (b.affiliate_score || 0) - (a.affiliate_score || 0));

  // Stats
  el.statCount.textContent = products.length;
  el.statTop.textContent = products.filter(p => p.label === "Rất nên làm").length;
  const avg = products.length
    ? Math.round(products.reduce((s, p) => s + (p.affiliate_score || 0), 0) / products.length)
    : 0;
  el.statAvg.textContent = avg;

  if (filtered.length === 0) {
    el.list.innerHTML = `<div class="empty-state">Không có sản phẩm phù hợp bộ lọc.</div>`;
    return;
  }

  el.list.innerHTML = filtered.map(p => {
    const price   = p.price ? formatPrice(p.price) : "N/A";
    const sold    = p.sold_count != null ? p.sold_count.toLocaleString("vi-VN") : "N/A";
    const rating  = p.rating != null ? p.rating : "N/A";
    const reviews = p.review_count != null ? p.review_count.toLocaleString("vi-VN") : "N/A";
    const shop    = p.shop_name || "N/A";
    return `
      <article class="card">
        <div class="card-top">
          <a class="card-name" href="${escapeAttr(p.product_url)}" target="_blank" rel="noopener">${escapeHtml(p.product_name || "(Không tên)")}</a>
          <span class="card-score" title="Affiliate Score / 100">${p.affiliate_score ?? 0}</span>
        </div>
        <div>
          <span class="${labelClass(p.label)}">${p.label}</span>
        </div>
        <div class="card-meta">
          <span>💰 <b>${price}</b></span>
          <span>📦 đã bán <b>${sold}</b></span>
          <span>⭐ <b>${rating}</b></span>
          <span>💬 <b>${reviews}</b></span>
        </div>
        <div class="card-shop">🏬 ${escapeHtml(shop)}</div>
        <div class="card-angle">💡 ${escapeHtml(p.content_angle || "")}</div>
      </article>
    `;
  }).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function formatPrice(n) {
  return Number(n).toLocaleString("vi-VN") + "₫";
}

// ----------------------- Scan flow ------------------------
async function scanCurrentPage() {
  hideStatus();
  setScanning(true);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      showStatus("Không xác định được tab hiện tại.", "error");
      return;
    }
    const isShopee = /^https?:\/\/([a-z0-9-]+\.)*shopee\.[a-z.]+/i.test(tab.url);
    if (!isShopee) {
      showStatus("Tab hiện tại không phải Shopee. Hãy mở trang Shopee rồi thử lại.", "warn");
      return;
    }

    // Đảm bảo content script đã được inject (phòng khi trang load trước extension)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
    } catch (_) { /* content_scripts đã chạy thì lệnh này có thể no-op */ }

    const response = await chrome.tabs.sendMessage(tab.id, { type: "SAPTH_SCAN" });
    if (!response || !response.ok) {
      showStatus("Không nhận được dữ liệu từ trang. Thử cuộn trang để load thêm sản phẩm rồi scan lại.", "error");
      return;
    }

    const raw = response.products || [];
    if (raw.length === 0) {
      showStatus("Không tìm thấy sản phẩm nào trên trang. Có thể trang chưa render xong hoặc Shopee đổi layout.", "warn");
      return;
    }

    const now = new Date().toISOString();
    const enriched = raw.map(p => {
      const { score, label, matchedCategory } = calculateAffiliateScore(p);
      const angle = generateContentAngle(p, matchedCategory);
      return {
        ...p,
        affiliate_score: score,
        label,
        content_angle: angle,
        scanned_at: now,
      };
    });

    const existing = await loadStored();
    const merged = mergeProducts(existing, enriched);
    await saveStored(merged);

    renderList(merged);
    showStatus(`✅ Đã scan ${enriched.length} sản phẩm. Tổng đang lưu: ${merged.length}.`, "success", 4000);
  } catch (err) {
    console.error(err);
    showStatus("Lỗi khi scan: " + (err && err.message ? err.message : err), "error");
  } finally {
    setScanning(false);
  }
}

// ----------------------- Export CSV -----------------------
function toCsvCell(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function exportCsv() {
  const list = await loadStored();
  if (list.length === 0) {
    showStatus("Chưa có sản phẩm để export.", "warn", 3000);
    return;
  }
  const headers = [
    "product_name","price","sold_count","rating","review_count",
    "shop_name","product_url","affiliate_score","label","content_angle","scanned_at"
  ];
  const rows = list.map(p => headers.map(h => toCsvCell(p[h])).join(","));
  const csv = "﻿" + headers.join(",") + "\n" + rows.join("\n"); // BOM cho Excel UTF-8

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `shopee-affiliate-products-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showStatus(`📁 Đã export ${list.length} sản phẩm ra CSV.`, "success", 3000);
}

// ----------------------- Clear ----------------------------
async function clearAll() {
  if (!confirm("Xoá toàn bộ sản phẩm đã lưu?")) return;
  await chrome.storage.local.remove(STORAGE_KEY);
  renderList([]);
  showStatus("🗑 Đã xoá toàn bộ sản phẩm.", "info", 3000);
}

// ----------------------- Init -----------------------------
document.addEventListener("DOMContentLoaded", async () => {
  el.btnScan.addEventListener("click", scanCurrentPage);
  el.btnExport.addEventListener("click", exportCsv);
  el.btnClear.addEventListener("click", clearAll);
  el.search.addEventListener("input", async () => renderList(await loadStored()));
  el.labelFilt.addEventListener("change", async () => renderList(await loadStored()));

  const stored = await loadStored();
  renderList(stored);
});
