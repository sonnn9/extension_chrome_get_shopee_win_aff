# Shopee Affiliate Product Hunter

Chrome Extension (Manifest V3) hỗ trợ tìm sản phẩm tiềm năng để làm **affiliate / content** trên Shopee.

Extension chỉ **đọc dữ liệu hiển thị công khai** trên tab Shopee bạn đang mở, **không** spam request, **không** auto-click, **không** crawl hàng loạt, **không** gửi dữ liệu ra ngoài. Toàn bộ dữ liệu lưu cục bộ trong `chrome.storage.local`.

---

## Tính năng (MVP)

**Tab 🎯 Hunter:**
- 🔍 **Scan Current Page** — đọc các sản phẩm đang hiển thị trên trang Shopee (search / category / shop / product page).
- 🧮 **Affiliate Score / 100** — chấm điểm theo công thức tổng hợp 6 nhóm + risk penalty (gồm **Sales Velocity** đo tốc độ bán gần đây).
- 🏷 **Phân nhãn** tự động: `Rất nên làm` · `Có tiềm năng` · `Cần cân nhắc` · `Bỏ qua`.
- 🔥 **Velocity badge**: 🔥 viral · ⚡ hot · 🌱 listing trẻ · 🕰 listing già.
- 💡 **Content angle** — gợi ý angle video ngắn theo nhóm ngành hàng.
- 💾 **Lưu local** với dedupe theo URL sản phẩm; scan lại sẽ cập nhật thông tin mới.
- 🔎 Lọc theo **tên** và **nhãn** ngay trong popup.
- ⬇ **Export CSV** (UTF-8 BOM, mở Excel/Sheets không vỡ tiếng Việt).
- 🗑 **Clear Saved Products** một click.

**Tab 📥 Image Downloader:**
- ✅ **Tick chọn từ tab Hunter** — mỗi card có checkbox + nút **"→ Gửi sang Downloader"** auto-fill link sang tab Downloader (selection được lưu trong `chrome.storage.local`, không mất khi đóng popup).
- ✅ **Chọn tất cả** trong tập đang lọc, đếm số đã chọn realtime.
- Hoặc **paste nhiều link sản phẩm Shopee** (mỗi link 1 dòng) thủ công.
- ⏱ **Delay 3–10s/link** (mặc định 4s) — không spam request.
- Chế độ: **main image only** hoặc **all product images**.
- ✅ Tuỳ chọn **Save product_info.json** kèm theo ảnh.
- 🎯 **Smart image extraction** — chỉ lấy ảnh trong **gallery container** (ảnh chính + carousel thumbnail), bỏ ảnh review / avatar / recommended / banner. Nguồn dữ liệu: `og:image` meta + JSON-LD `Product.image` + DOM của gallery container.
- 🌀 Auto-scroll trigger lazy-load + chờ SPA render trước khi đọc ảnh.
- Lưu vào folder: `Shopee_Product_Images/<product_name_or_id>/`
  - `main_image_01.jpg`
  - `product_image_02.jpg`, `product_image_03.jpg`, …
  - `product_info.json` (product_name, product_url, shop_name, price, downloaded_at, image_urls)
- Có **Stop** giữa chừng, log realtime, progress bar.

> ⚠ **Lưu ý copyright:** Ảnh tải về **chỉ dùng cho research/reference cá nhân**. Tôn trọng bản quyền của seller/brand và quy định Shopee Affiliate.

---

## Cấu trúc thư mục

```
extension_chrome_get_shopee_win_aff/
├── README.md
├── prompt.txt
└── shopee-affiliate-product-hunter/      ← folder load vào Chrome
    ├── manifest.json     # MV3 + permissions: activeTab, storage, scripting, tabs, downloads
    ├── popup.html        # UI 420px, 2 tab: Hunter & Image Downloader
    ├── popup.css         # Card, label màu, velocity badge, spinner, tabs, downloader
    ├── popup.js          # Scoring, content angle, selection state, CSV export, dl orchestrator client
    ├── content.js        # DOM scanner (Hunter) + image extractor (Downloader, chỉ gallery)
    └── background.js     # Service worker: init storage + Image Downloader orchestrator
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

### A. Săn sản phẩm (tab 🎯 Hunter)

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

### B. Tải ảnh sản phẩm (tab 📥 Image Downloader)

**Cách 1 — Tick chọn từ kết quả scan (khuyến nghị):**

1. Ở tab **🎯 Hunter**, tick checkbox bên trái mỗi card sản phẩm muốn tải ảnh.
   - Có thể dùng **"Chọn tất cả hiện tại"** để tick mọi sản phẩm đang lọc.
   - Số lượng đã chọn hiển thị realtime: `Đã chọn: N`.
2. Bấm **"→ Gửi sang Downloader"** → tab tự chuyển + textarea tự fill các link.
3. Chọn **mode** (main image only / all product images), tick **Save product_info.json** nếu cần.
4. Đặt **Delay** (3–10s, mặc định 4s) → bấm **▶ Start Download**.
5. Theo dõi progress bar + log; có thể bấm **■ Stop** để dừng giữa chừng.
6. Ảnh được lưu vào thư mục Downloads/`Shopee_Product_Images/<tên_sản_phẩm>/`.

**Cách 2 — Paste link thủ công:**

1. Vào trực tiếp tab **📥 Image Downloader**.
2. Paste nhiều link sản phẩm Shopee, mỗi link 1 dòng.
3. Làm tiếp bước 3–6 ở Cách 1.

---

## Công thức chấm điểm

Tổng tối đa **100 điểm** = 5 nhóm điểm cộng − Risk penalty:

| Nhóm | Max | Logic |
|---|---:|---|
| **Sales Volume** | 15 | 2000+ sold = 15 · 500–2000 = 12 · 50–500 = 7 · 1–50 = 4 · 0 = 0 |
| **Sales Velocity** | 10 | Ưu tiên `sold_recent` ("đã bán X trong tháng"): 1000+/th = 10 · 300+ = 8 · 100+ = 6 · 30+ = 4. Fallback heuristic review/sold ratio: <2% = 6 (listing trẻ/viral) · 2–8% = 4 · 8–15% = 2 · >15% = 0 (listing già) |
| **Rating** | 20 | ≥4.8 = 20 · 4.6–4.79 = 16 · 4.3–4.59 = 10 · <4.3 = 4 |
| **Reviews** | 15 | 1000+ = 15 · 300+ = 12 · 100+ = 9 · 30+ = 6 · 1+ = 3 |
| **Price** | 15 | 99k–499k = 15 (sweet spot) · 50k–99k = 11 · 499k–900k = 8 · <50k = 5 · >900k = 3 |
| **Content potential** | 15 | +15 nếu tên match nhóm: gia dụng thông minh / mẹ & bé / học sinh / làm đẹp / phụ kiện ĐT / đồ bếp / decor / tiện ích |
| **Risk penalty** | −10 | Từ khoá nhạy cảm (giảm cân, cam kết 100%, fake, …) + rating <4 + sold <10 |

**Velocity badge** trên card:

| Badge | Ý nghĩa |
|---|---|
| 🔥 **1k+/tháng** (đỏ) | Đang viral mạnh — vào content ngay |
| ⚡ 300+/tháng (cam) | Đang hot, còn cửa |
| ⚡ 100+/tháng (vàng) | Ổn định |
| 🌱 **listing trẻ** | Review/sold <2% → mới list hoặc đang viral → vào sớm dễ ăn |
| 🕰 listing già | Review/sold >15% → bán đã lâu, có thể hết trend |

**Phân nhãn:**

| Score | Nhãn | Màu |
|---|---|---|
| 80–100 | Rất nên làm | 🟢 xanh lá |
| 65–79 | Có tiềm năng | 🔵 xanh dương |
| 50–64 | Cần cân nhắc | 🟠 cam |
| <50 | Bỏ qua | 🔴 đỏ nhạt |

---

## CSV Export

Cột xuất ra: `product_name, price, sold_count, sold_recent, sold_per_month, rating, review_count, shop_name, product_url, affiliate_score, label, content_angle, scanned_at`.

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

## Chiến thuật săn sản phẩm "Rất nên làm" hiệu quả

Extension chỉ chấm điểm những gì bạn **mở ra** — nên kết quả tốt hay không phụ thuộc vào **bạn mở đúng trang**. Dưới đây là playbook thực chiến.

### 1. Chọn đúng "vùng săn" thay vì search bừa

Điểm cao = sold cao + rating cao + review nhiều + giá 99k–499k + tên thuộc nhóm dễ làm content. Vậy hãy mở thẳng vào nơi Shopee đã gom sẵn các đặc tính đó:

| Vùng săn | URL pattern | Vì sao điểm trung bình cao |
|---|---|---|
| **Top Sales của ngành hàng** | `shopee.vn/<ngành>-cat.<id>?sortBy=sales` | Đã sort theo sold → thoả luôn 25đ Sales |
| **Shopee Mall + sortBy=sales** | thêm filter `Shopee Mall` | Rating thường ≥4.7, ít hàng fake → ít risk penalty |
| **Khoảng giá 99k–499k** | filter `priceMin=99000&priceMax=499000` | Trúng sweet spot Price 15đ |
| **Flash Sale / Top sản phẩm trong ngày** | `shopee.vn/flash_sale` | Sold tăng nhanh, review nhiều |
| **Trang shop top seller** | shop có badge "Yêu thích+" / Mall | Listing đồng đều chất lượng |
| **Daily Discover khi cuộn home** | scroll trang chủ | Shopee đã đề xuất theo trending |

> 💡 Mẹo: mở 4–5 tab cùng lúc với nhiều ngành khác nhau (đồ bếp, mẹ&bé, làm đẹp, phụ kiện ĐT, decor) → scan từng tab → so sánh "Trung bình điểm" trong popup.

### 2. Quy trình săn 10 phút/ngày

```
1. Chọn 1 ngành (VD: đồ bếp)
2. Mở: shopee.vn/Đồ-Dùng-Nhà-Bếp-cat.<id>?sortBy=sales&priceMin=99000&priceMax=499000
3. Cuộn xuống ~5 lần để load đủ 60–100 sản phẩm
4. Scan Current Page
5. Lọc nhãn = "Rất nên làm" trong popup
6. Đổi keyword: thêm filter "Shopee Mall", scan tiếp → merge tự động
7. Export CSV cuối ngày
```

Lặp với 5 ngành/ngày → ~50 sản phẩm "Rất nên làm" / tuần.

### 3. Keyword search tăng tỷ lệ trúng

Thay vì search 1 từ chung chung, dùng các pattern này (đều khớp `CATEGORY_KEYWORDS` trong [popup.js](shopee-affiliate-product-hunter/popup.js)):

- **Đồ bếp:** "dụng cụ bếp đa năng", "đồ tiện ích nhà bếp", "khay đựng thông minh"
- **Gia dụng thông minh:** "máy hút bụi mini", "robot lau nhà", "đèn cảm biến"
- **Mẹ & bé:** "đồ chơi giáo dục", "bình sữa silicone", "ti giả sơ sinh"
- **Học sinh / VPP:** "bút máy học sinh", "sổ tay đẹp", "kẹp giấy đa năng"
- **Làm đẹp:** "serum dưỡng da", "mặt nạ giấy", "son lì kem"
- **Phụ kiện ĐT:** "giá đỡ điện thoại", "cáp sạc nhanh", "ốp lưng iPhone"
- **Decor:** "đèn ngủ trang trí", "khung tranh", "thảm trải sàn mini"

Các từ này **luôn cộng đủ 15đ Content potential** → kéo điểm trung bình lên rõ.

### 4. Lọc nhanh sau khi scan

Trong popup:

1. Chọn dropdown nhãn = **"Rất nên làm"** → chỉ còn ≥80đ.
2. Sắp xếp đã sẵn theo score giảm dần.
3. Click vào tên sản phẩm → mở tab mới → **scan lại trang sản phẩm đơn lẻ** để lấy thêm review_count chính xác → score sẽ refresh.

### 5. Mẹo nâng độ chính xác

| Vấn đề | Cách xử lý |
|---|---|
| Sold count hiển thị "1,2k" → score đúng | Đã tự parse, không cần làm gì |
| Rating ở grid không hiện → bị 0đ oan | Mở trang sản phẩm đơn → scan lại để cập nhật |
| Giá range "99k - 199k" → lấy giá thấp nhất | Đúng intent (impulse buy) |
| Sản phẩm fake/copy chen vào | Filter Shopee Mall hoặc shop badge "Yêu thích+" trước khi scan |
| Trang chỉ load 30 sản phẩm | Cuộn nhiều lần — Shopee lazy-load theo viewport |

### 6. Đọc chỉ số "Trung bình điểm" như compass

Hiển thị ở stats top popup:

- **>70**: vùng săn cực ngon, exploit thêm bằng cách scan các trang tương tự (cùng ngành, shop khác).
- **55–70**: ổn, lọc nhãn để chỉ giữ "Rất nên làm".
- **<55**: bỏ vùng đó, đổi ngành / đổi filter giá.

Dùng số này để biết nên ở lại vùng nào, không phí thời gian scan vùng kém.

---

## Troubleshooting

| Triệu chứng | Cách xử lý |
|---|---|
| `Failed to load extension — _locales subtree is missing` | Đảm bảo `manifest.json` không có `default_locale`, hoặc tạo folder `_locales/`. |
| Bấm Scan thấy "Tab hiện tại không phải Shopee" | URL phải khớp `*://shopee.<tld>/*`. Mở đúng trang Shopee rồi thử lại. |
| Scan ra 0 sản phẩm | Cuộn trang xuống cho Shopee render thêm card, đợi vài giây rồi scan lại. |
| Một số field N/A | Shopee có thể đổi layout / không hiển thị field đó ở grid. Mở trang sản phẩm đơn lẻ để scan đủ thông tin hơn. |
| Cập nhật code không thấy đổi | Vào `chrome://extensions/` → bấm **Reload** ở card extension. |
| Tất cả nút trong popup không bấm được | Mở DevTools popup (chuột phải vào popup → **Inspect**) → tab **Console** xem lỗi JS. Thường do syntax error trong popup.js. |
| Downloader tải nhầm ảnh review / avatar | Đã fix: chỉ quét ảnh trong gallery container. Nếu vẫn xảy ra ở 1 layout lạ, mở trang sản phẩm đó trong tab thường xem `<h1>` có nằm trong flex/grid container chuẩn không. |
| Downloader 0 ảnh | Tăng delay lên 6–8s để Shopee SPA render gallery. Hoặc mở trang sản phẩm thử trực tiếp xem ảnh có hiện không. |
| Ảnh tải về là thumbnail mờ | Đã fix: code tự bỏ suffix `_tn` để lấy bản gốc. Nếu vẫn mờ, có thể Shopee đã đổi naming convention CDN. |

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
- Permissions: `activeTab`, `storage`, `scripting`, `tabs`, `downloads`.
- Storage keys (`chrome.storage.local`):
  - `sapth_products` — array sản phẩm đã scan, dedupe theo `product_url`.
  - `sapth_selection` — array URL đã tick để gửi sang Downloader.
- Toàn bộ scoring & angle logic ở [popup.js](shopee-affiliate-product-hunter/popup.js) — pure functions, dễ test.
- Scanner sản phẩm ở [content.js](shopee-affiliate-product-hunter/content.js) — viết theo heuristic (link `-i.<shopId>.<itemId>` → tìm card cha → suy luận text), tránh phụ thuộc class name của Shopee.
- **Image extractor** ở [content.js](shopee-affiliate-product-hunter/content.js):
  - Walk up từ `<h1>` tìm flex/grid ancestor → chọn sibling không chứa `<h1>` mà có nhiều `<img>` nhất → đó là gallery container.
  - Nguồn ảnh: `og:image` + JSON-LD (`@type: Product`, bỏ nhánh review/comment/author) + DOM trong gallery container (src/srcset/data-*/background-image).
  - Build URL gốc qua `https://down-vn.img.susercontent.com/file/<hash>` (bỏ suffix `_tn`).
  - Cap tối đa 12 ảnh/sản phẩm để tránh lẫn rác.
- **Downloader orchestrator** ở [background.js](shopee-affiliate-product-hunter/background.js):
  - Mở tab inactive → `waitForTabComplete` (timeout 20s) → inject content.js → chờ 3s SPA render → gọi `SAPTH_EXTRACT_IMAGES` → `chrome.downloads.download` từng ảnh → đóng tab → delay 3–10s → tiếp link kế.
  - JSON lưu qua `data:` URL (service worker không có `URL.createObjectURL`).
  - Có cơ chế cancel cho nút Stop, log realtime qua message `SAPTH_DL_LOG/PROGRESS/DONE`.

---

## License

MIT — sử dụng tự do cho mục đích cá nhân và nghiên cứu. Bạn tự chịu trách nhiệm tuân thủ điều khoản sử dụng của Shopee tại quốc gia của mình.
