# 🌏 台越翻譯機 · Vietnam–Taiwan Translator

> 越南語 ↔ 繁體中文翻譯 PWA，用 AI 搞定南北越腔調、男女用語與回譯確認。

[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org/)

---

## ✨ 特色

| 功能 | 說明 |
|------|------|
| **越 ↔ 中** | 雙向翻譯，支援南越（西貢）／北越（河內）用語 |
| **說話者** | 男性／女性／不區分，對應越南語人稱與語氣 |
| **對象與語氣** | 長輩、平輩、情人、同事等 + 正式／口語／親暱／敬語 |
| **回譯** | 中→越時自動顯示「翻回中文的約略意思」，傳出去前先確認 |
| **解釋** | 單字拆解、文法重點、縮寫／網路用語（簡要呈現） |
| **PWA** | 可加到手機主畫面，離線也能開介面 |
| **多裝置同步** | 登入後金鑰與設定同步，公司／家裡／手機都能用 |

---

## 🚀 快速開始

```bash
git clone https://github.com/RayzChang/vn_translator.git
cd vn_translator
npm install
npm run dev
```

瀏覽器開 **http://localhost:5173**，到 **設定** 貼上 [Google AI Studio](https://aistudio.google.com/apikey) 的 Gemini API 金鑰即可使用。

---

## 📱 部署（Vercel）

1. 在 [Vercel](https://vercel.com) 用 GitHub 登入，**Import** 此 repo。
2. 直接 **Deploy**，取得網址。
3. 手機開網址 → **加到主畫面**，即可當 App 用。

若要**登入與多裝置同步**，需在 Vercel 專案加 **Postgres** 與環境變數（`DATABASE_URL`、`ENCRYPTION_KEY`、`JWT_SECRET`），詳見 `docs/P2-後端部署與環境變數.md`。

---

## 🛠 技術

- **前端**：Vite、React、TypeScript、Tailwind CSS、PWA
- **翻譯**：Google Gemini API（可選 Flash / Pro 等模型）
- **後端（選用）**：Vercel Serverless、PostgreSQL、JWT、金鑰加密

---

## 📄 授權

僅供個人與學習使用。

---

**Repo**：[https://github.com/RayzChang/vn_translator](https://github.com/RayzChang/vn_translator)
