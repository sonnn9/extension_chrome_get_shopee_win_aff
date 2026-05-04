/* =========================================================
 * Shopee Affiliate Product Hunter — background.js (MV3 SW)
 * ---------------------------------------------------------
 * Hiện tại chưa cần xử lý nền phức tạp. Service worker này
 * chủ yếu để init storage và log lifecycle, sẵn sàng mở
 * rộng cho roadmap (theo dõi sản phẩm theo ngày, alarm, v.v.)
 * ========================================================= */

const STORAGE_KEY = "sapth_products";

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  console.log("[SAPTH] installed:", reason);
  const { [STORAGE_KEY]: existing } = await chrome.storage.local.get(STORAGE_KEY);
  if (!Array.isArray(existing)) {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[SAPTH] service worker started");
});
