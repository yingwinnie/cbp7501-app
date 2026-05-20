# CBP 7501 Entry Summary 系統

> 美國海關報關文件（CBP Form 7501）自動化編輯與預覽工具

🔗 **Live Demo**：[cbp7501-app.vercel.app](https://cbp7501-app.vercel.app)

---

## 功能簡介

| 功能 | 說明 |
|------|------|
| 📄 PDF 上傳 | 上傳 CBP 7501 PDF，自動驗證格式並抽取文字 |
| ✏️ 線上編輯 | 編輯 Description、Entered Value、HTSUS Rate 等欄位 |
| 🧮 即時計算 | 自動計算 Duty、MPF（499）、HMF（501）、Grand Total |
| ⚠️ 破版警告 | Description 超過 180 字時顯示警告 |
| 🔍 排版預覽 | 匯出前預覽完整 CBP 7501 表單排版 |
| 🛡️ PDF 驗證 | 雙層驗證（Magic Bytes + pdfjs 結構解析）擋下損毀檔案 |

---

## 畫面截圖

### 登入頁
- 帳號：`winnie` / 密碼：`password`（Demo 用 hardcode）

### 文件列表
- 顯示報關文件清單，可上傳新 PDF

### 編輯頁
- Yellow Zone 欄位可編輯
- 右側即時顯示試算結果

### 預覽頁
- 完整 CBP 7501 表單預覽，確認後可匯出

---

## 技術架構

```
前端：React 18 + TypeScript
樣式：Tailwind CSS（CDN Play）
PDF 解析：pdfjs-dist v3.11.174（CDN 動態載入）
部署：Vercel（CI/CD 自動化）
版本控制：GitHub
```

### 專案結構

```
cbp7501-app/
├── public/
│   └── index.html          # 含 Tailwind CDN
├── src/
│   ├── App.tsx             # 主程式（登入／列表／編輯／預覽）
│   ├── index.tsx           # React 入口
│   └── react-app-env.d.ts
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## PDF 驗證邏輯

上傳時執行兩層驗證，任一失敗即阻擋：

1. **Magic Bytes 檢查**：檔案前 5 bytes 必須是 `%PDF-`
2. **結構解析**：透過 pdfjs 實際解析 PDF 結構，損毀檔無法通過

---

## 計算公式

| 費用 | 公式 |
|------|------|
| Duty | `Entered Value × HTSUS Rate` |
| MPF (499) | `min(max(Value × 0.3464%, $27.75), $528.33)` |
| HMF (501) | `Value × 0.125%` |
| Grand Total | `Duty + MPF + HMF` |

---

## 自動化測試

使用 Playwright（Python）對 100 份 PDF 進行端對端測試：

| TC | 類別 | 數量 | 結果 |
|----|------|------|------|
| TC01 | 標準單頁 | 40 份 | ✅ 100% |
| TC02 | 多頁 Continuation | 10 份 | ✅ 100% |
| TC04 | 免稅 Rate=0 | 10 份 | ✅ 100% |
| TC05 | 超長 Description 警告 | 10 份 | ✅ 100% |
| TC08 | 多 Line Items | 15 份 | ✅ 100% |
| TC10 | 損毀 PDF 阻擋 | 5 份 | ✅ 100% |
| TC11 | MPF 邊界值 | 10 份 | ✅ 100% |
| **合計** | | **101 件** | **✅ 100%** |

---

## 目前限制（Prototype）

這是前端展示版本，尚未接後端：

- ⚠️ 上傳的 PDF 不會新增至列表（無資料庫）
- ⚠️ 重新整理後資料不保留（無持久化儲存）
- ⚠️ 登入帳密為 hardcode（無使用者驗證系統）
- ⚠️ 僅支援單筆 Line Item

---

## 本機開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm start

# 建置生產版本
npm run build
```

---

## 開發紀錄

- **2026-05-20**：完成 PDF 文字抽取、損毀 PDF 阻擋、100% 自動化測試通過、部署至 Vercel

---

*Built with React + TypeScript．Deployed on Vercel*
