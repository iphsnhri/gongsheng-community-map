# 共生誌互動地圖

這是可直接部署到 GitHub Pages 的靜態網站。正式網站檔案位於 `dist/`，不需要 GAS 或後端服務。

## 本機預覽

請以 HTTP 伺服器開啟 `dist/`，不要直接雙擊 `index.html`，因為瀏覽器會阻擋網頁讀取本機 CSV。

例如在 `website` 目錄執行：

```powershell
python -m http.server 4173 --directory dist
```

然後開啟 `http://localhost:4173/`。

## 資料更新

1. 更新專案根目錄的 `社區資料定稿.csv`。
2. 人工確認後，複製成 `website/dist/data/communities.csv`。
3. 確認欄名與 C001–C030 ID 不變。
4. 照片網址與 YouTube 網址填入後，網站會自動顯示媒體；空白時顯示準備中。

## GitHub Pages

此資料夾可直接作為一個 GitHub 儲存庫。已附上 `.github/workflows/deploy-pages.yml`：推送至 `main` 後，在 GitHub 儲存庫的 **Settings → Pages → Source** 選擇 **GitHub Actions**，即可由 `dist/` 發布。

正式發布前請確認公開儲存庫只包含網站檔案與核准展示資料，不要加入原始故事、查核中間資料或聯絡個資。

分享特定社區可使用 `?community=C010`，不依賴子路徑路由。
