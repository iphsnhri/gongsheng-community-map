# Impeccable 技術稽核報告

稽核日期：2026-10-02  
稽核對象：`dist/` 與正式網站 `https://iphsnhri.github.io/gongsheng-community-map/`

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|---|---:|---|
| 1 | Accessibility | 3/4 | 低對比文字與模態焦點限制已修正；地圖旋轉仍可補鍵盤操作 |
| 2 | Performance | 3/4 | 網站精簡，但動態照片與 YouTube iframe 尚未延遲載入 |
| 3 | Responsive Design | 3/4 | 320×568 與 390×844 均無水平溢出；搜尋與地圖已分離，觸控目標達 44px |
| 4 | Theming | 3/4 | 主色大多已有 CSS 變數；單一淺色主題符合本專案定位 |
| 5 | Implementation Integrity | 3/4 | 架構與視覺語言一致；偵測器多項通用警告屬於專案刻意設計 |
| **Total** |  | **15/20** | **Good — P1 項目已清除，剩餘為 P2 強化項目** |

## Implementation Integrity Verdict

**通過。** 網站有清楚的產品專屬視覺與互動系統：臺灣地形、縣市標籤、30 個社區定位、桌機定位卡片、手機底部卡片、搜尋與縣市篩選都由同一套色彩、字體與互動規則組成。Impeccable 偵測出的米色背景、左右對齊內文與裁切容器並非任意套版，分別對應既定示意圖、使用者指定的中文分散對齊，以及全螢幕地圖的必要遮罩，因此不列為缺陷。

## Executive Summary

- Audit Health Score：**15/20（Good）**
- 問題數：**P0 0、P1 0、P2 4、P3 0**
- 手機 320×568 與 390×844：沒有水平溢出；搜尋框與北部標記保有安全距離；社區卡片能捲動
- 搜尋輸入字級為 16px，聚焦前後 viewport scale 維持 1；雙擊後可繼續連續拖曳
- 鍵盤結構：主要導覽、搜尋、篩選、地圖控制及 30 個社區均可由可存取樹辨識
- 最需要先處理：低對比小字、手機觸控目標、模態視窗焦點限制

## Detailed Findings by Severity

### Resolved — 部分小字未達 WCAG AA 對比

- **Location**：`dist/styles.css:2`、`dist/styles.css:28`、`dist/styles.css:49`、`dist/styles.css:74`
- **Category**：Accessibility
- **Evidence**：偵測器量得 `#8CA677` / `#FFFFFF` 為 2.7:1、`#6F7A6E` / `#F2F0E9` 為 3.9:1、`#8E9089` 在白色或米色背景約 2.8–3.2:1；一般小字需要 4.5:1。
- **Impact**：低視力、戶外強光或低品質投影環境下，地址、來源註記、清單次要文字與提示可能難以閱讀。
- **WCAG**：1.4.3 Contrast (Minimum)
- **Recommendation**：保留既有綠灰色調，但將一般小字改為較深的語意色票；裝飾性大字可依實際字級個別判定。
- **Resolution**：已加深 muted、sage、故事引文、欄位 placeholder 與小標文字；重跑偵測器後低對比警告由 5 項降為 0。

### Resolved — 手機主要觸控目標過小

- **Location**：`dist/styles.css:64`、`dist/styles.css:74`、`dist/styles.css:82-86`
- **Category**：Responsive / Accessibility
- **Evidence**：390×844 模擬視窗中，地圖標記多為 16×16px，選取後約 23×23px；卡片關閉為 31×31px；頂部、清單及地圖控制多為 38×38px。手機另有大型社區清單作為替代入口，但直接點地圖仍容易誤觸。
- **Impact**：手指操作時難以精準選擇密集社區，尤其北部與臺南、高雄一帶。
- **WCAG**：2.5.8 Target Size (Minimum), WCAG 2.2
- **Recommendation**：保留 16px 視覺圓點，在 `::before` 或透明外層建立至少 44×44px 的點擊區；控制鈕與關閉鈕至少 44×44px。
- **Resolution**：手機地圖標記、地圖控制、頂部控制、面板及卡片關閉按鈕均為至少 44×44px；密集標記依觸點距離選擇最近社區。

### Resolved — 「關於計畫」模態視窗未限制鍵盤焦點

- **Location**：`dist/app.js:545-558`、`dist/index.html:110`
- **Category**：Accessibility
- **Evidence**：開啟後焦點會先移至關閉鈕，但連續按 Tab 會依序離開對話框，進入頁面 Body、品牌連結、導覽、搜尋與篩選；背景仍可被鍵盤操作。
- **Impact**：鍵盤與螢幕閱讀器使用者可能失去目前所在的對話框脈絡。
- **WCAG**：2.4.3 Focus Order、4.1.2 Name, Role, Value
- **Recommendation**：開啟時將背景設為 `inert`，在對話框內循環 Tab / Shift+Tab，關閉後還原至原觸發按鈕。現有 Escape 與焦點還原邏輯可保留。
- **Resolution**：開啟時背景設為 inert，Tab / Shift+Tab 留在對話框內，Escape 關閉後焦點回到原觸發按鈕。連續五次 Tab 實測均停留在對話框內。

### P2 — 地圖旋轉沒有鍵盤等價操作

- **Location**：`dist/index.html:66`、`dist/app.js:561-591`
- **Category**：Accessibility
- **Evidence**：地圖宣告為 `role="application"`，旋轉只接受指標拖曳；鍵盤只能使用放大、縮小與重設按鈕。社區本身仍可由按鈕或清單選擇，因此核心內容沒有被阻擋。
- **Impact**：鍵盤使用者無法體驗完整的立體旋轉，但仍能瀏覽社區內容。
- **WCAG**：2.1.1 Keyboard
- **Recommendation**：提供左右旋轉按鈕或在地圖聚焦時支援方向鍵，並更新簡短操作說明；若旋轉純裝飾，也可移除 `role="application"` 以降低輔助科技模式切換負擔。
- **Suggested command**：`$impeccable adapt`

### P2 — 全域 reduced-motion 規則直接壓到 0.01ms

- **Location**：`dist/styles.css:90`
- **Category**：Accessibility / Implementation Integrity
- **Evidence**：所有元素的 animation 與 transition 都被全域改為 `.01ms`。
- **Impact**：雖能避免暈動，但也會移除部分可幫助理解狀態變化的回饋，例如底部卡片出現與側欄開合。
- **Recommendation**：針對地圖轉場、卡片與側欄個別提供低動態版本，以淡入或立即定位取代全面清除。
- **Suggested command**：`$impeccable animate`

### P2 — 動態媒體未使用延遲載入

- **Location**：`dist/app.js:441-451`
- **Category**：Performance
- **Evidence**：社區照片 `<img>` 與 YouTube `<iframe>` 沒有 `loading="lazy"`；照片也沒有固定寬高屬性。
- **Impact**：加入正式 YouTube 影片後，開啟卡片可能立即載入較重的第三方播放器；圖片尺寸未知時可能產生小幅版面位移。
- **Recommendation**：照片加入 `loading="lazy" decoding="async"`，iframe 加入 `loading="lazy"`；若照片比例固定，提供 `width` / `height` 或保持現有 aspect-ratio 容器。
- **Suggested command**：`$impeccable optimize`

### P2 — 部署目錄含未被頁面引用的大型地形檔

- **Location**：`dist/assets/taiwan-terrain-render-v2.png`、`dist/assets/taiwan-terrain-nlsc.png`、`dist/assets/kinmen-terrain-v2.webp`
- **Category**：Performance / Implementation Integrity
- **Evidence**：三個舊版素材約 1.64MB、272KB、107KB；正式 CSS 使用的是 `taiwan-terrain-calibrated.png` 與 `kinmen-terrain-v3.webp`。
- **Impact**：不增加一般訪客首屏網路流量，但會增加部署產物與版本庫大小，並提高未來誤用舊資產的風險。
- **Recommendation**：確認沒有回復舊版需求後，將未引用檔移出 `dist/`，保留在來源或備份位置。
- **Suggested command**：`$impeccable optimize`

## Detector Findings Classified as Intentional / False Positive

- **Cream / beige palette**：與既定示意圖及品牌視覺一致，保留。
- **Justified text**：使用者已明確要求所有計畫內文分散對齊，且 CSS 使用 `text-justify: inter-character`，保留。
- **Clipped overflow containers**：`body`、`.page-shell`、`.map-view` 的裁切是全螢幕地圖構圖所需；桌機卡片會計算邊界，手機卡片改用固定底部面板，實測未被裁切。
- **Missing dark mode**：本成果展示頁採固定視覺主題，目前不是產品需求，不扣分。

## Positive Findings

- HTML 有 `header`、`main`、`nav`、標題層級與可辨識的互動元素。
- 社區標記使用真正的 button，並同步 `aria-pressed`；搜尋與篩選結果有 `aria-live` 回饋。
- 所有 30 個社區在可存取樹均有完整社區名稱與縣市資訊。
- 鍵盤焦點有清楚外框；Escape 可依序關閉計畫視窗、社區清單與社區卡片。
- 手機版卡片採獨立可捲動區，實測內容能完整向下閱讀。
- 地圖拖曳使用 Pointer Events、pointer capture、pointercancel 與 `touch-action`；390×844 模擬視窗的指標拖曳成功。此證據來自瀏覽器模擬視窗與滑鼠指標拖曳，尚未取代 iOS / Android 實機多點觸控測試。
- 網站沒有前端框架與第三方 JavaScript bundle，HTML、CSS、JS 與 CSV 本身合計約 86KB，基礎結構精簡。

## Recommended Actions

1. **[P2] `$impeccable adapt`**：補充鍵盤旋轉方式或調整地圖 role。
2. **[P2] `$impeccable animate`**：改寫 reduced-motion 的狀態回饋。
3. **[P2] `$impeccable optimize`**：延遲載入媒體並整理未引用資產。
4. **[P3] `$impeccable polish`**：所有修正完成後做一次桌機與手機確認。

修正後應重新執行 `$impeccable audit`，確認分數與問題數是否改善。
