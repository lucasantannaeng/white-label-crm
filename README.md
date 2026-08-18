# 💼 Solar Service — Multi-Tenant White-Label CRM & Field Operations

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Edge%20Functions%20%26%20RLS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vitest](https://img.shields.io/badge/Vitest-25%20Passed-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise Multi-Tenant White-Label CRM, Sales Pipeline, and Field Service Operations Platform for Solar PV and Technical Service Integrators.**

---

## 🌟 Overview

**Solar Service White-Label CRM** is a multi-tenant platform architected for solar energy contractors, field engineering teams, and technical service providers. It unifies lead capture, commercial proposal generation, dynamic contract signing (`.docx`/`.pdf`), schedule conflict management, route optimization, sales commission tracking, and AI-assisted edge functions.

---

## 🚀 Key Features

* 👥 **Omnichannel Customer & Opportunity Pipeline**:
  * Visual Kanban board with stage transition tracking, status badges, and service history.
  * **ClienteDrawer360**: 360-degree customer timeline aggregating contracts, maintenance visits, technical inspection records, and invoices.
* 🧮 **Commercial Pricing Engine (`CalculadoraPage.tsx`)**:
  * Dynamic pricing calculator with tiered volume discounts, payback simulation, and strict mathematical discount clamping (`Math.max/Math.min`).
* 📄 **Automated Contract Generation & Digital Signatures (`contractUtils.ts`)**:
  * Automated `.docx` and `.pdf` contract generation from dynamic templates with built-in **Zip Slip / Path Traversal protection**.
  * Integrated HTML5 canvas digital signature capture (`SignaturePad`).
* 📅 **Conflict-Aware Scheduling & Route Management**:
  * Service agenda with automated time-slot collision detection (`AgendaConflictDialog`).
  * Field team assignment and geographic route optimization.
  * Real-time weather alerts and precipitation risk notifications (`WeatherPopup`).
* 🤖 **AI-Powered Edge Functions (Deno / Supabase)**:
  * `ai-image-analysis`: Computer vision inspection of solar panel cleanings and inverter nameplates.
  * `ai-route-optimizer`: LLM-driven field team routing and scheduling.
  * `ai-voice-assistant`: Voice command processing and field audio notes.
  * `ai-weather-alert`: Automated meteorological risk forecasting.
* 🏢 **True White-Label Architecture**:
  * Dynamic brand customization (Logos, primary/secondary color palettes, custom domains, and modular feature flags).
  * Role-Based Access Control (RBAC) with Master Admin, Manager, Technician, and Sales Representative roles.

---

## 🏗️ Architecture

```
WhiteLableCRM/
├── src/
│   ├── components/crm/
│   │   ├── DashboardPage.tsx       # KPI overview & analytics
│   │   ├── ClientesPage.tsx        # Customer directory & Kanban board
│   │   ├── CalculadoraPage.tsx     # Proposal generator with discount guard
│   │   ├── ContratosPage.tsx       # Contract management & DOCX generator
│   │   ├── ClienteDrawer360.tsx    # 360-degree client timeline
│   │   ├── AgendaPage.tsx          # Service calendar with conflict prevention
│   │   └── SignaturePad.tsx        # Digital signature canvas
│   ├── lib/
│   │   ├── contractUtils.ts        # Hardened DOCX generator (Zip Slip protected)
│   │   └── formatters.ts           # Currency, date, and text formatters
│   ├── hooks/
│   │   ├── useAuth.ts              # RBAC & authentication state
│   │   └── useRouteOptimizer.ts    # Route optimization triggers
│   └── test/                       # 25 Vitest tests (Dogfood, Integration, Unit)
├── supabase/
│   ├── functions/                  # AI Edge Functions (Deno / TypeScript)
│   └── migrations/                 # PostgreSQL multi-tenant RLS schema & RBAC
├── package.json
└── vite.config.ts
```

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript 5.8, Tailwind CSS, Shadcn UI / Radix |
| **Document Processing** | Docxtemplater, PizZip, jsPDF, FileSaver |
| **Backend / Cloud** | Supabase (PostgreSQL 15), Supabase Auth, Deno Edge Functions |
| **Testing** | Vitest (25 test suites passing) |

---

## ⚡ Getting Started

### 1. Prerequisites
* Node.js `>= 18.0.0`
* npm or pnpm

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/lucasantannaeng/white-label-crm.git
cd white-label-crm

# Install dependencies
npm install

# Setup environment configuration
cp .env.example .env
```

### 3. Development Server

```bash
npm run dev
```

---

## 🧪 Testing

```bash
# Run the complete test suite
npm test

# Build production bundle
npm run build
```

---

## 📄 License

Licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
Authored by **Luca Rodrigues Gomes de Sant'Anna**.
