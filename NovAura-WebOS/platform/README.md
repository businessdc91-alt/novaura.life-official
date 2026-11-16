# NovAura Platform - Unified

**The complete creator marketplace + domain platform fusion.**

---

## 🚀 Quick Start

```bash
cd "Z:\Novaura platform\NovAura-Unified"
npm install
npm run dev
```

**Production Build:**
```bash
npm run build
```

---

## 📁 Project Structure

```
NovAura-Unified/
├── src/
│   ├── components/
│   │   ├── ui/              # 58+ shadcn/ui components
│   │   ├── layout/          # Layout wrappers
│   │   ├── checkout/        # Checkout flow
│   │   ├── ide/             # Aura IDE components
│   │   ├── builder/         # Site builder
│   │   └── social/          # Social features
│   ├── pages/
│   │   ├── public/          # Public pages (35)
│   │   ├── buyer/           # Buyer pages (9)
│   │   ├── creator/         # Creator pages (6)
│   │   ├── admin/           # Admin pages (5)
│   │   └── novalow/         # Novalow features (6)
│   ├── services/            # 26 business logic services
│   ├── stores/              # 6 Zustand state stores
│   ├── utils/               # Utility functions
│   ├── types/               # TypeScript types
│   ├── constants/           # Constants
│   ├── legal/               # Legal documents
│   └── hooks/               # Custom hooks
├── public/                  # Static assets
└── docs/                    # Documentation
```

---

## ✨ Features

### NovAura Market (Original)
- ✅ **Marketplace**: Browse, search, purchase assets
- ✅ **Creator Dashboard**: Upload, manage, earn
- ✅ **Cart & Checkout**: Full purchase flow
- ✅ **Admin Panel**: User/asset/order management
- ✅ **Social Features**: Following, messaging, feed
- ✅ **Gallery**: Community showcases
- ✅ **Aura IDE**: Web-based development environment

### Novalow Domains (Integrated)
- ✅ **Domain Search**: 500+ TLDs, availability check
- ✅ **Hosting Plans**: Starter/Pro/Business tiers
- ✅ **Site Builder**: Template gallery, drag & drop
- ✅ **Dev Tools**: CLI, API, webhooks
- ✅ **Tutorials**: AI workflow guides
- ✅ **Security**: SSL, DDoS, compliance
- ✅ **Promote**: Advertising packages

---

## 🌐 Routes

### Public Routes
- `/` - Home
- `/browse` - Asset discovery
- `/asset/:slug` - Asset details
- `/creator/:username` - Creator profile
- `/search` - Search results
- `/domains` - Domain marketplace **(NEW)**
- `/hosting` - Hosting plans **(NEW)**
- `/builder` - Site builder **(NEW)**
- `/devtools` - Developer tools **(NEW)**
- `/tutorials` - Tutorials **(NEW)**
- `/security` - Security features **(NEW)**
- `/promote` - Advertising **(NEW)**

### Protected Routes
- `/cart`, `/checkout`, `/orders`, `/downloads`
- `/creator/dashboard`, `/creator/assets`, `/creator/upload`
- `/admin/dashboard`, `/admin/users`, `/admin/assets`

---

## 🏗️ Architecture

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand (persistent stores)
- **Data**: TanStack Query (React Query)
- **Animation**: Framer Motion
- **Icons**: Lucide React

---

## 📝 Legacy Folders

**⚠️ DO NOT USE:**
- `Z:\Novaura platform\app/` - Original NovAura Market
- `Z:\Novaura platform\Kimi_Agent_Novalow Domains Launch Plan/` - Original Novalow

See `LEGACY_FOLDERS_README.md` for details.

---

## 🌟 Deployment

**Target Platform:** Polsia

**Build Command:**
```bash
npm run build
```

**Output:** `dist/` folder ready for deployment

---

## 🔧 Status

**Version:** 1.0.0 (Unified)  
**Last Updated:** 2026-03-15  
**Status:** Production Ready

---

Built with ❤️ for the NovAura ecosystem.
