# WaytoAR 模型 AR 網站

以靜態網頁快速瀏覽 `model/` 資料夾中的 USDZ 模型，並透過 Apple AR Quick Look 一鍵開啟。縮圖與 `.usdz` 使用相同檔名即可自動配對。

## 快速開始

1. 安裝相容版本的 Node.js（18 以上）。
2. 於專案根目錄執行：

   ```bash
   npm install      # 第一次使用時建立 package-lock，可略過
   npm run generate # 掃描 model/ 產生 data/models.json
   npm run start    # 啟動本地簡易伺服器（使用 http-server）
   ```

3. 連到終端顯示的網址（預設 http://localhost:4173）即可預覽。

## 新增 / 更新模型流程

1. 把 `.usdz` 放在 `model/`，並放入同檔名縮圖（支援 `.jpg/.jpeg/.png/.webp/.avif`）。
2. 執行 `npm run generate` 重新寫入 `data/models.json`。
3. 重新整理網頁即可看到新模型。若部署到 GitHub Pages，記得把更新後的 `data/models.json` 一併提交。

## 部署到 GitHub Pages

專案已內建 `.github/workflows/deploy.yml`，會在 push 到 `main`（或手動執行 Workflow）時自動：

1. 以 Node.js 18 執行 `scripts/generate-model-manifest.mjs`，即使沒手動跑 `npm run generate` 也能取得最新清單。
2. 打包 `index.html`、`assets/`、`data/` 與 `model/` 成 Pages Artifact。
3. 透過 `actions/deploy-pages@v4` 發佈到 GitHub Pages。

首次設定步驟：

1. 將 repo push 到 GitHub，並在 **Settings ▸ Pages** 將 **Source** 改為 **GitHub Actions**。
2. 確認 branch 名稱與 workflow 觸發條件相符（預設 `main`）。
3. 之後只要把新的 `.usdz`/縮圖 push 上去，網頁就會在部署完成後自動顯示新增模型。

## AR 使用注意事項

- `開啟 AR` 按鈕使用 Apple Quick Look：需以 iOS / iPadOS 的 Safari 開啟。
- 桌機或 Android 裝置可先瀏覽縮圖、複製連結分享給支援 AR 的裝置。
- 若需要支援 Android 原生 AR，可另行提供 `.glb` / `.gltf` 並延伸此網頁。

## 專案結構

```
WaytoAR
├── assets
│   ├── css/styles.css    # 頁面樣式
│   └── js/main.js        # 清單載入與互動邏輯
├── data/models.json      # 由腳本產生的 manifest
├── model/                # 放置 USDZ 與縮圖
├── scripts/generate-model-manifest.mjs
└── index.html
```

