# SaaS-Based Communication and Shop Management System
### Phase 1 – Super Admin & Shop Owner Management Panels

---

## 🌟 Overview
An enterprise-ready, Multi-Tenant SaaS platform engineered with **Node.js (REST API)** and **Next.js (Administrative Web Panels)**, backed by **Firebase Firestore, Authentication, and Cloud Storage** architecture.

### Key Capabilities Built:
1. **Super Admin Platform Governance**: Centralized dashboard matching global telemetry, multi-shop tenant restrictions, tier package creation & quota enforcement, bank slip review/approval, protected account change requests, and system-wide audit logs.
2. **Shop Owner & Multi-Branch Operations**: Auto-provisioned Default Branch (`BR-13`), multi-branch context switcher (`BR-14`), staff role assignments, product & service catalog, inventory tracking with low-stock alerts, procurement flow (Purchase Orders $\rightarrow$ Goods Received Notes auto-syncing branch stock), order point-of-sale, task assignments, and direct ticketed communication with Super Admin.
3. **Reusable Package Limitation Engine (`BR-03`, `BR-09`, `BR-10`)**: Backend security boundary automatically calculating quota usage and blocking unauthorized resource creation.
4. **Folder-Wise Postman API Collection**: Comprehensive Postman Collection v2.1 covering all endpoints across 16 folders with environment variable presets and automated token extraction.

---

## 🏗️ Project Architecture

```
├── apps/
│   ├── api/                 # Node.js + Express + TypeScript Backend REST API
│   └── admin-web/           # Next.js 14 + Tailwind CSS + TypeScript Admin Panels
├── packages/
│   ├── types/               # Shared TypeScript DTOs & Domain Models
│   └── validation/          # Shared Zod Validation Schemas
├── postman/
│   ├── SaaS_Management_System_v1.postman_collection.json
│   └── SaaS_Local_Environment.postman_environment.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Install Dependencies
In the root directory, run:
```bash
npm install
```

### 2. Start the Backend API (Port 5000)
```bash
npm run dev:api
```
*Note: The API initializes with an automatic data seeder containing demo Super Admin, Shop Owner, Staff, Products, Branches, and Inventory balances.*

### 3. Start the Next.js Admin Panel (Port 3000)
```bash
npm run dev:web
```
Navigate to `http://localhost:3000` in your browser.

---

## 🔑 Pre-Seeded Demo Credentials

| Role | Email | Password | Description |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@platform.com` | `Admin@123456` | Platform Overview, Shops, Packages, Payments & Audit Logs |
| **Shop Owner** | `owner@urbancafe.com` | `Shop@123456` | Urban Cafe Hub (Multi-Branch, Orders, Stock, PO $\rightarrow$ GRN) |
| **Manager** | `sarah.manager@urbancafe.com` | `Staff@123456` | Branch Manager |
| **Worker** | `alex.barista@urbancafe.com` | `Staff@123456` | Task Assignment & Daily Operations |

---

## 📮 Postman Collection Import Guide

1. Open Postman $\rightarrow$ Click **Import**.
2. Select the files in `./postman/`:
   - `SaaS_Management_System_v1.postman_collection.json`
   - `SaaS_Local_Environment.postman_environment.json`
3. Select the **SaaS Platform - Local Environment** in the top-right environment selector.
4. Run `01. Authentication & Session -> Super Admin Login` or `Shop Owner Login`—the collection test script automatically saves the `adminToken` and `ownerToken` into the environment for all subsequent calls!
