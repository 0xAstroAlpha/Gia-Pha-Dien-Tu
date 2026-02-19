# ClanHub (GiaPhaHub)

Nền tảng gia phả & cộng đồng dòng họ.

## Tổng quan

ClanHub là nền tảng quản lý gia phả trực tuyến, được phát triển qua 3 giai đoạn:

- **Phase 1:** Single-tenant MVP cho dòng họ Lê Huy
- **Phase 2:** Community Layer (Feed, Groups, Events)
- **Phase 3:** SaaS Multi-tenant

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, shadcn/ui, Tailwind CSS v4 |
| Backend | Express.js, TypeScript, Prisma, PostgreSQL 16 |
| Genealogy | Gramps Web API (Docker) |
| Storage | MinIO (S3-compatible) |
| Infrastructure | Docker Compose, Caddy |

## Quick Start

```bash
# Clone & install
git clone <repo-url> clanhub
cd clanhub
npm install

# Setup environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start all services (Docker)
npm run docker:up

# Or run locally (dev mode)
npm run dev
```

## Project Structure

```
clanhub/
├── frontend/          # Next.js 15 App
├── backend/           # Express.js API
├── docker/            # Docker Compose configs
├── docs/              # Documentation
├── _bmad/             # BMAD Method framework
└── _bmad-output/      # BMAD artifacts
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start FE + BE in dev mode |
| `npm run build` | Build production bundles |
| `npm run lint` | Lint all projects |
| `npm run test` | Run all tests |
| `npm run docker:up` | Start Docker Compose |
| `npm run db:migrate` | Run Prisma migrations |

## License

Private — Dòng họ Lê Huy
