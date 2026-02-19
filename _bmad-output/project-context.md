# ClanHub — Project Context for AI Agents

## Project Overview
ClanHub (GiaPhaHub) — nền tảng gia phả & cộng đồng dòng họ. Phase 1 là Single-tenant MVP cho dòng họ Lê Huy.

## Architecture
- **Frontend:** Next.js 15 (App Router) + TypeScript + shadcn/ui + Tailwind CSS v4
- **Backend:** Express.js + TypeScript + Prisma + PostgreSQL 16
- **Genealogy:** Proxy → Gramps Web API (Python/Flask, Docker)
- **Storage:** MinIO (S3-compatible) for media files
- **Auth:** JWT (access 15min + refresh 7d) + RBAC (Admin > Editor > Archivist > Member > Guest)

## Critical Patterns

### Module Structure (Backend)
```
backend/src/modules/<module>/
├── routes.ts        # Express router
├── controller.ts    # Request/Response handling
├── service.ts       # Business logic
└── dto.ts           # Zod schemas for validation
```

### API Response Format
```typescript
{ success: boolean, data?: T, error?: { code: string, message: string } }
```

### Privacy Filter (MANDATORY)
- All genealogy data MUST flow through `privacyFilter()` on the server
- Living persons (no death record) → filter fields based on user role
- FE is display-only; never trust client for privacy

### Middleware Order
Request → Rate Limit → CORS → Body → Auth → RBAC → Privacy → Controller → Error → Audit

## Conventions
- **Git:** Conventional Commits (feat:, fix:, chore:)
- **API:** RESTful, prefix `/api`, pagination via `?page=1&limit=20`
- **Date:** ISO 8601
- **Imports:** Use path aliases (`@/modules/...`, `@/shared/...`)

## Environment Variables
See `.env.example` in backend/ and frontend/ directories.

## Key Files
- PRD: `prd (1).md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Epics: `_bmad-output/planning-artifacts/epics-phase1.md`
- Sprint Status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
