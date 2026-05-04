# Shopee Affiliate Product Hunter

Chrome Extension (Manifest V3) hỗ trợ tìm sản phẩm tiềm năng để làm **affiliate / content** trên Shopee.

Extension chỉ **đọc dữ liệu hiển thị công khai** trên tab Shopee bạn đang mở, **không** spam request, **không** auto-click, **không** crawl hàng loạt, **không** gửi dữ liệu ra ngoài. Toàn bộ dữ liệu lưu cục bộ trong `chrome.storage.local`.

---

## Tính năng (MVP)

- 🔍 **Scan Current Page** — đọc các sản phẩm đang hiển thị trên trang Shopee (search / category / shop / product page).
- 🧮 **Affiliate Score / 100** — chấm điểm theo công thức tổng hợp 5 nhóm + risk penalty.
- 🏷 **Phân nhãn** tự động: `Rất nên làm` · `Có tiềm năng` · `Cần cân nhắc` · `Bỏ qua`.
- 💡 **Content angle** — gợi ý angle video ngắn theo nhóm ngành hàng (đồ bếp, mẹ & bé, làm đẹp, gia dụng thông minh, …).
- 💾 **Lưu local** với dedupe theo URL sản phẩm; scan lại sẽ cập nhật thông tin mới.
- 🔎 Lọc theo **tên** và **nhãn** ngay trong popup.
- ⬇ **Export CSV** (UTF-8 BOM, mở Excel/Sheets không vỡ tiếng Việt).
- 🗑 **Clear Saved Products** một click.

---

## Cấu trúc thư mục

```
extension_chrome_get_shopee_win_aff/
├── README.md
├── prompt.txt
└── shopee-affiliate-product-hunter/      ← folder load vào Chrome
    ├── manifest.json     # MV3, host_permissions cho mọi domain Shopee
    ├── popup.html        # UI 420px
    ├── popup.css         # Card, label màu, spinner
    ├── popup.js          # Scoring, content angle, storage, CSV export
    ├── content.js        # DOM scanner linh hoạt (chống đổi class)
    └── background.js     # Service worker (init storage, sẵn sàng mở rộng)
```

---

## Cài đặt

1. Tải / clone repo này về máy.
2. Mở Chrome → truy cập `chrome://extensions/`.
3. Bật **Developer mode** (góc trên bên phải).
4. Click **Load unpacked** → chọn folder `shopee-affiliate-product-hunter/`.
5. Ghim icon extension vào thanh công cụ cho tiện.

> 💡 Khi cập nhật code, vào `chrome://extensions/` bấm nút **Reload** ở card extension.

---

## Cách dùng

1. Mở một trang Shopee bất kỳ:
   - Trang search: `shopee.vn/search?keyword=...`
   - Trang category: `shopee.vn/<Tên-ngành-hàng>-cat.<id>`
   - Trang shop: `shopee.vn/<shop_username>`
   - Trang sản phẩm đơn lẻ: `shopee.vn/<slug>-i.<shopId>.<itemId>`
2. **Cuộn trang** xuống để Shopee load đủ sản phẩm bạn muốn quét.
3. Click icon extension → **🔍 Scan Current Page**.
4. Xem điểm, nhãn và content angle ngay trong popup.
5. Lọc theo tên / nhãn để rà nhanh.
6. **⬇ Export CSV** khi đã ưng → dùng cho Sheets / Notion / TikTok content plan.

---

## Công thức chấm điểm

Tổng tối đa **100 điểm** = 5 nhóm điểm cộng − Risk penalty:

| Nhóm | Max | Logic |
|---|---:|---|
| **Sales** | 25 | 2000+ sold = 25 · 500–2000 = 20 · 50–500 = 12 · 1–50 = 6 · 0 = 0 |
| **Rating** | 20 | ≥4.8 = 20 · 4.6–4.79 = 16 · 4.3–4.59 = 10 · <4.3 = 4 |
| **Reviews** | 15 | 1000+ = 15 · 300+ = 12 · 100+ = 9 · 30+ = 6 · 1+ = 3 |
| **Price** | 15 | 99k–499k = 15 (sweet spot) · 50k–99k = 11 · 499k–900k = 8 · <50k = 5 · >900k = 3 |
| **Content potential** | 15 | +15 nếu tên match nhóm: gia dụng thông minh / mẹ & bé / học sinh / làm đẹp / phụ kiện ĐT / đồ bếp / decor / tiện ích |
| **Risk penalty** | −10 | Từ khoá nhạy cảm (giảm cân, cam kết 100%, fake, …) + rating <4 + sold <10 |

**Phân nhãn:**

| Score | Nhãn | Màu |
|---|---|---|
| 80–100 | Rất nên làm | 🟢 xanh lá |
| 65–79 | Có tiềm năng | 🔵 xanh dương |
| 50–64 | Cần cân nhắc | 🟠 cam |
| <50 | Bỏ qua | 🔴 đỏ nhạt |

---

## CSV Export

Cột xuất ra: `product_name, price, sold_count, rating, review_count, shop_name, product_url, affiliate_score, label, content_angle, scanned_at`.

File có **BOM UTF-8** — mở thẳng bằng Excel / Google Sheets là đọc được tiếng Việt.

---

## Quy tắc an toàn & tuân thủ

Extension **KHÔNG**:

- Tự động click sản phẩm / tự tạo đơn / tự tạo click affiliate.
- Crawl ồ ạt nhiều trang liên tục, vượt CAPTCHA, hoặc né cơ chế bảo vệ.
- Gửi dữ liệu người dùng đi nơi khác — không có backend, không telemetry.
- Đọc dữ liệu riêng tư không hiển thị trên trang.

Extension **CHỈ**:

- Đọc DOM hiển thị công khai trên đúng tab Shopee bạn đang mở.
- Phân tích, chấm điểm và lưu **local** trong trình duyệt.

---

## Troubleshooting

| Triệu chứng | Cách xử lý |
|---|---|
| `Failed to load extension — _locales subtree is missing` | Đảm bảo `manifest.json` không có `default_locale`, hoặc tạo folder `_locales/`. |
| Bấm Scan thấy "Tab hiện tại không phải Shopee" | URL phải khớp `*://shopee.<tld>/*`. Mở đúng trang Shopee rồi thử lại. |
| Scan ra 0 sản phẩm | Cuộn trang xuống cho Shopee render thêm card, đợi vài giây rồi scan lại. |
| Một số field N/A | Shopee có thể đổi layout / không hiển thị field đó ở grid. Mở trang sản phẩm đơn lẻ để scan đủ thông tin hơn. |
| Cập nhật code không thấy đổi | Vào `chrome://extensions/` → bấm **Reload** ở card extension. |

---

## Roadmap nâng cao

- [ ] Bộ lọc theo **ngành hàng** (auto từ `matchedCategory`).
- [ ] **Range slider score** (min–max) thay vì chỉ filter theo nhãn.
- [ ] **Theo dõi nhiều ngày**: lưu thêm `history: [{scanned_at, sold_count, price}]`, vẽ trend.
- [ ] **Ô ghi chú content idea** cho từng sản phẩm.
- [ ] **Import/Export JSON** (full backup, giữ history).
- [ ] **Prompt video TikTok/Reels** — sinh hook + script 15s từ name + category + price.
- [ ] **Caption bán hàng** — 3 variant (cảm xúc / lý trí / tò mò).
- [ ] **Auto-niche clustering** — gom nhóm sản phẩm theo TF-IDF tên.
- [ ] **Dashboard tab riêng** — top sản phẩm theo niche, biểu đồ score distribution, sold trend.

---

## Dev notes

- Stack: **Manifest V3** + JS thuần + HTML/CSS, không framework, không build step.
- Storage key: `sapth_products` (array, dedupe theo `product_url`).
- Toàn bộ scoring & angle logic ở [popup.js](shopee-affiliate-product-hunter/popup.js) — pure functions, dễ test.
- Scanner DOM ở [content.js](shopee-affiliate-product-hunter/content.js) — viết theo heuristic (link `-i.<shopId>.<itemId>` → tìm card cha → suy luận text), tránh phụ thuộc class name của Shopee.

---

## License

MIT — sử dụng tự do cho mục đích cá nhân và nghiên cứu. Bạn tự chịu trách nhiệm tuân thủ điều khoản sử dụng của Shopee tại quốc gia của mình.
