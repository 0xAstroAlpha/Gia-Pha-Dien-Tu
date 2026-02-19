# PlanPhase1 — Kiến trúc FE & BE cho ClanHub (Giai đoạn 1)

**Phiên bản:** v1.0  
**Ngày:** 2026-02-19  
**Tham chiếu:** `prd (1).md` — Giai đoạn 1 "Lê Huy Only" (Single-tenant MVP)

---

## 1. Tổng quan mục tiêu Phase 1

Xây dựng website gia phả cho **dòng họ Lê Huy** (single-tenant) với các tính năng:

- Đăng nhập / phân quyền (RBAC) / mời thành viên
- Xem & duyệt cây gia phả (tree browse, person profile, family view)
- Bảo vệ quyền riêng tư người còn sống (Living Privacy)
- Thư viện tư liệu (Media Library) + quy trình duyệt
- Audit log cho mọi thao tác chỉnh sửa
- Backup & export dữ liệu (GEDCOM + DB)

---

## 2. Chiến lược tích hợp Gramps Web

Theo khuyến nghị PRD → **Option 2**: Giữ Gramps Web như một **Genealogy Service** độc lập, build ứng dụng ClanHub riêng gọi vào Gramps Web API.

```mermaid
graph LR
    subgraph ClanHub["ClanHub Application"]
        FE["Frontend<br/>(Next.js)"]
        BE["Backend API<br/>(Node.js/Express)"]
    end
    subgraph Gramps["Gramps Web (Docker)"]
        GW_API["Gramps Web API<br/>(Python/Flask)"]
        GW_DB["Gramps DB<br/>(SQLite)"]
    end
    S3["Object Storage<br/>(S3/MinIO)"]
    DB["PostgreSQL"]

    FE -->|REST/GraphQL| BE
    BE -->|REST Proxy| GW_API
    GW_API --> GW_DB
    BE --> DB
    BE --> S3
```

**Lý do chọn Option 2:**
- Không fork → dễ cập nhật upstream Gramps Web
- Tách rõ domain: genealogy core vs. ClanHub business logic
- Dễ mở rộng sang Phase 2 (community) và Phase 3 (multi-tenant)

---

## 3. Technology Stack

### 3.1 Frontend

| Thành phần | Công nghệ | Lý do |
|---|---|---|
| Framework | **Next.js 15** (App Router) | SSR/SSG, routing, SEO, React ecosystem |
| Language | **TypeScript** | Type safety, DX |
| UI Library | **shadcn/ui** + **Radix UI** | Accessible components, customizable |
| Styling | **Tailwind CSS v4** | Utility-first, design tokens |
| State Management | **Zustand** | Nhẹ, đơn giản cho Phase 1 |
| Data Fetching | **TanStack Query (React Query)** | Caching, invalidation, optimistic updates |
| Tree Visualization | **D3.js** hoặc **React Flow** | Vẽ cây gia phả interactive |
| Form | **React Hook Form** + **Zod** | Validation, performance |
| Auth Client | **NextAuth.js v5** | JWT session, middleware protection |
| Icons | **Lucide React** | Nhất quán với shadcn/ui |

### 3.2 Backend

| Thành phần | Công nghệ | Lý do |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Ecosystem JS, team thống nhất FE/BE |
| Framework | **Express.js** hoặc **Fastify** | Nhẹ, linh hoạt, middleware ecosystem |
| Language | **TypeScript** | Shared types với FE |
| ORM | **Prisma** | Type-safe queries, migration, introspection |
| Database | **PostgreSQL 16** | Reliable, JSON support, full-text search |
| Auth | **JWT** (access + refresh token) | Stateless, phù hợp API |
| Password Hash | **bcrypt** hoặc **argon2** | Industry standard |
| File Upload | **Multer** + **S3 SDK** | Stream upload trực tiếp S3/MinIO |
| Object Storage | **MinIO** (dev) / **S3** (prod) | Compatible S3 API, signed URLs |
| Email | **Nodemailer** + **Resend** | Invite link, password reset |
| Validation | **Zod** | Share schemas FE ↔ BE |
| Logging | **Pino** | Structured JSON logging |
| API Docs | **Swagger/OpenAPI** via `swagger-jsdoc` | Tự sinh docs từ code |

### 3.3 Infrastructure

| Thành phần | Công nghệ |
|---|---|
| Containerization | **Docker** + **Docker Compose** |
| Gramps Web | **Docker image** (official) |
| Reverse Proxy | **Nginx** hoặc **Caddy** |
| CI/CD | **GitHub Actions** |
| Hosting | **VPS** (Hetzner/DigitalOcean) hoặc **Railway** |
| Monitoring | **UptimeRobot** + **Pino** logs |

---

## 4. Kiến trúc Backend chi tiết

### 4.1 Cấu trúc thư mục

```
backend/
├── src/
│   ├── config/            # env, database, storage config
│   ├── middleware/         # auth, rbac, error-handler, rate-limit
│   ├── modules/
│   │   ├── auth/          # controller, service, routes, dto
│   │   ├── user/          # controller, service, routes, dto
│   │   ├── genealogy/     # proxy → Gramps Web API
│   │   ├── media/         # upload, approve, list, tag
│   │   ├── audit/         # log service, query
│   │   └── backup/        # export GEDCOM, DB snapshot
│   ├── shared/
│   │   ├── guards/        # RBAC guard
│   │   ├── decorators/    # custom decorators
│   │   ├── utils/         # helpers
│   │   └── types/         # shared TypeScript types
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── app.ts             # Express/Fastify app setup
├── tests/
├── Dockerfile
├── .env.example
└── package.json
```

### 4.2 Database Schema (PostgreSQL — Prisma)

```prisma
// === IDENTITY & ACCESS ===

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  displayName   String
  role          Role      @default(MEMBER)
  status        UserStatus @default(ACTIVE)
  avatarUrl     String?
  phone         String?
  invitedBy     String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  media         Media[]
  auditLogs     AuditLog[]  @relation("actor")
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model InviteLink {
  id        String   @id @default(cuid())
  code      String   @unique
  role      Role     @default(MEMBER)
  maxUses   Int      @default(1)
  usedCount Int      @default(0)
  expiresAt DateTime?
  createdBy String
  createdAt DateTime @default(now())
}

enum Role {
  ADMIN
  EDITOR
  ARCHIVIST
  MEMBER
  GUEST
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  PENDING
}

// === MEDIA & ARCHIVE ===

model Media {
  id              String      @id @default(cuid())
  fileKey         String      // S3 object key
  fileName        String
  mimeType        String
  fileSize        Int
  title           String?
  description     String?
  date            DateTime?
  linkedPersonId  String?     // Gramps person handle
  linkedEventType String?     // birth, death, marriage...
  state           MediaState  @default(PENDING)
  uploaderId      String
  uploader        User        @relation(fields: [uploaderId], references: [id])
  reviewedBy      String?
  reviewedAt      DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

enum MediaState {
  PENDING
  PUBLISHED
  REJECTED
}

// === AUDIT LOG ===

model AuditLog {
  id           String   @id @default(cuid())
  actorId      String
  actor        User     @relation("actor", fields: [actorId], references: [id])
  action       String   // CREATE, UPDATE, DELETE, EXPORT, LOGIN...
  entityType   String   // user, person, media, family...
  entityId     String?
  diffSummary  Json?    // { field: { old, new } }
  ipAddress    String?
  createdAt    DateTime @default(now())
}

// === PRIVACY CONFIG ===

model PrivacyConfig {
  id                String  @id @default(cuid())
  hideLivingDetails Boolean @default(true)
  memberCanSee      Json    // ["name", "birthYear"]
  editorCanSee      Json    // ["name", "birthYear", "birthDate", "phone"]
  adminCanSee       Json    // ["*"]
  updatedAt         DateTime @updatedAt
}

// === BACKUP ===

model BackupRecord {
  id         String   @id @default(cuid())
  type       String   // GEDCOM, DB_SNAPSHOT
  fileKey    String   // S3 key
  fileSize   Int
  createdBy  String
  createdAt  DateTime @default(now())
}
```

### 4.3 API Endpoints

#### Auth (`/api/auth`)

| Method | Path | Mô tả | Role |
|---|---|---|---|
| POST | `/register` | Đăng ký qua invite code | Public |
| POST | `/login` | Đăng nhập → access + refresh token | Public |
| POST | `/refresh` | Refresh access token | Auth |
| POST | `/logout` | Xóa refresh token | Auth |
| POST | `/forgot-password` | Gửi email reset | Public |
| POST | `/reset-password` | Đặt lại password | Public |

#### Users (`/api/users`)

| Method | Path | Mô tả | Role |
|---|---|---|---|
| GET | `/` | Danh sách thành viên | Admin |
| GET | `/me` | Profile cá nhân | Auth |
| PATCH | `/me` | Cập nhật profile | Auth |
| PATCH | `/:id/role` | Đổi role | Admin |
| PATCH | `/:id/status` | Suspend/Activate | Admin |
| POST | `/invite` | Tạo invite link | Admin |
| GET | `/invite` | Danh sách invite links | Admin |

#### Genealogy Proxy (`/api/genealogy`)

| Method | Path | Mô tả | Role |
|---|---|---|---|
| GET | `/people` | Danh sách người (proxy Gramps) | Member+ |
| GET | `/people/:handle` | Chi tiết 1 người | Member+ |
| GET | `/families` | Danh sách gia đình | Member+ |
| GET | `/families/:handle` | Chi tiết gia đình | Member+ |
| GET | `/tree` | Dữ liệu vẽ cây | Member+ |
| PUT | `/people/:handle` | Sửa thông tin người | Editor+ |
| POST | `/people` | Thêm người mới | Editor+ |
| POST | `/families` | Thêm quan hệ gia đình | Editor+ |
| DELETE | `/people/:handle` | Xóa người | Admin |

> **Lưu ý:** Module `genealogy` hoạt động như **proxy layer** — nhận request từ FE, áp dụng privacy filter + RBAC, rồi forward sang Gramps Web API. Response từ Gramps cũng được filter trước khi trả về FE.

#### Media (`/api/media`)

| Method | Path | Mô tả | Role |
|---|---|---|---|
| POST | `/upload` | Upload file + metadata | Member+ |
| GET | `/` | Danh sách media (filter by state, person) | Member+ |
| GET | `/:id` | Chi tiết media + signed URL | Member+ |
| PATCH | `/:id/approve` | Duyệt media | Archivist+ |
| PATCH | `/:id/reject` | Từ chối media | Archivist+ |
| DELETE | `/:id` | Xóa media | Admin |

#### Audit Log (`/api/audit`)

| Method | Path | Mô tả | Role |
|---|---|---|---|
| GET | `/` | Query audit log (filter, pagination) | Admin, Editor |
| GET | `/entity/:type/:id` | Log theo entity cụ thể | Admin, Editor |

#### Backup (`/api/backup`)

| Method | Path | Mô tả | Role |
|---|---|---|---|
| POST | `/export/gedcom` | Trigger export GEDCOM | Admin |
| POST | `/snapshot` | Trigger DB snapshot | Admin |
| GET | `/` | Danh sách backup records | Admin |
| GET | `/:id/download` | Download 1 backup (signed URL) | Admin |

### 4.4 Middleware Pipeline

```
Request
  → Rate Limiter (express-rate-limit)
  → CORS
  → Body Parser
  → Auth Middleware (verify JWT → attach user)
  → RBAC Guard (check role vs. required role)
  → Privacy Filter (filter living person data based on role)
  → Controller → Service → Response
  → Error Handler (centralized)
  → Audit Logger (async, post-response)
```

### 4.5 Genealogy Proxy — Privacy Filter Logic

```typescript
// Pseudocode
function filterPerson(person: GrampsPerson, userRole: Role): FilteredPerson {
  const isLiving = person.death === null && !person.deceased;
  
  if (!isLiving) return person; // Người đã mất → hiển thị đầy đủ
  
  const config = await getPrivacyConfig();
  const allowedFields = config[`${userRole}CanSee`]; // e.g. ["name", "birthYear"]
  
  if (allowedFields.includes("*")) return person; // Admin → full
  
  return {
    ...pickFields(person, allowedFields),
    _privacyNote: "Thông tin bị ẩn do chính sách bảo mật người còn sống"
  };
}
```

---

## 5. Kiến trúc Frontend chi tiết

### 5.1 Cấu trúc thư mục

```
frontend/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (auth)/                  # Auth layout group
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── (main)/                  # Main layout group (sidebar + header)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx             # Home / Dashboard
│   │   │   ├── tree/page.tsx        # Family tree view
│   │   │   ├── people/
│   │   │   │   ├── page.tsx         # People list + search
│   │   │   │   └── [handle]/        # Person profile
│   │   │   │       └── page.tsx
│   │   │   ├── media/
│   │   │   │   ├── page.tsx         # Media library
│   │   │   │   └── [id]/page.tsx    # Media detail
│   │   │   └── admin/
│   │   │       ├── users/page.tsx
│   │   │       ├── audit/page.tsx
│   │   │       └── backup/page.tsx
│   │   ├── api/                     # API routes (NextAuth, etc.)
│   │   ├── layout.tsx               # Root layout
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── layout/                  # Header, Sidebar, Footer
│   │   ├── tree/                    # TreeCanvas, TreeNode, TreeControls
│   │   ├── person/                  # PersonCard, PersonProfile, RelationshipList
│   │   ├── media/                   # MediaUploader, MediaGrid, MediaViewer
│   │   ├── auth/                    # LoginForm, RegisterForm
│   │   └── admin/                   # UserTable, AuditTable, BackupPanel
│   ├── hooks/                       # Custom hooks
│   │   ├── use-auth.ts
│   │   ├── use-people.ts
│   │   ├── use-media.ts
│   │   └── use-audit.ts
│   ├── lib/
│   │   ├── api-client.ts            # Axios/fetch wrapper
│   │   ├── auth.ts                  # NextAuth config
│   │   ├── utils.ts                 # Helpers
│   │   └── constants.ts
│   ├── stores/                      # Zustand stores
│   │   ├── auth-store.ts
│   │   └── tree-store.ts
│   └── types/                       # Shared TypeScript types
│       ├── user.ts
│       ├── person.ts
│       ├── media.ts
│       └── api.ts
├── public/
├── next.config.ts
├── tailwind.config.ts
├── Dockerfile
└── package.json
```

### 5.2 Các trang chính (Pages)

#### 5.2.1 Home / Dashboard
- Thống kê nhanh: tổng số người trong gia phả, số thành viên, media mới
- Quick search: tìm kiếm người theo tên
- Activity feed: thay đổi gần đây (từ audit log)
- Shortcut: xem tree, upload tư liệu

#### 5.2.2 Tree View (`/tree`)
- Canvas vẽ cây gia phả dùng **D3.js** hoặc **React Flow**
- Zoom / Pan / Focus on person
- Click vào node → mở person profile
- Các chế độ hiển thị:
  - Ancestor chart (ngược lên)
  - Descendant chart (xuôi xuống)
  - Hourglass chart (cả hai chiều)
- Thanh tìm kiếm để jump tới 1 người

#### 5.2.3 People List (`/people`)
- Danh sách tất cả thành viên trong gia phả
- Search theo tên, năm sinh, chi họ
- Filter: giới tính, còn sống/đã mất, chi nhánh
- Click → mở person profile

#### 5.2.4 Person Profile (`/people/[handle]`)
- **Tabs:**
  - **Overview**: tên, giới, ngày sinh/mất, nơi ở, ghi chú
  - **Relationships**: cha/mẹ, vợ/chồng, con cái — link tới profile tương ứng
  - **Media**: ảnh/tài liệu đã gắn vào người này
  - **Sources**: nguồn tư liệu tham chiếu
  - **History**: audit log cho entity này
- Living Privacy badge: hiển thị "🔒 Thông tin bị giới hạn" nếu là người còn sống và user không có quyền xem đầy đủ

#### 5.2.5 Media Library (`/media`)
- Grid view ảnh/tài liệu
- Filter theo: trạng thái (pending/published), người liên kết, ngày upload
- Upload modal: kéo thả file, nhập metadata (title, description, date), chọn link person/event
- Archivist/Admin: tab "Chờ duyệt" (pending queue)
- Click ảnh → viewer với signed URL

#### 5.2.6 Admin Pages (`/admin/*`)
- **Users**: bảng danh sách user, tạo invite link, đổi role, suspend
- **Audit Log**: bảng log có filter (actor, action, entity, date range), pagination
- **Backup**: trigger export GEDCOM, trigger DB snapshot, danh sách backup + download

### 5.3 UX / Design System

- **Theme**: Dark/Light mode toggle
- **Layout**: Sidebar (collapse trên mobile) + Header + Content area
- **Typography**: Inter font (Google Fonts)
- **Color palette**: Warm earth tones (phù hợp theme gia đình/truyền thống)
  - Primary: `#8B4513` (Saddle Brown) hoặc tùy chỉnh
  - Accent: `#D4A574` (Gold/Tan)
  - Neutral: Slate tones
- **Responsive**: Mobile-first, breakpoints: sm/md/lg/xl
- **Animations**: Framer Motion cho page transitions và micro-interactions

---

## 6. Luồng nghiệp vụ chính (Business Flows)

### 6.1 Đăng ký & Onboarding

```mermaid
sequenceDiagram
    participant A as Admin
    participant S as System
    participant M as New Member

    A->>S: Tạo invite link (POST /api/users/invite)
    S-->>A: Invite URL + code
    A->>M: Gửi invite link (email/Zalo)
    M->>S: Mở link → /register?code=xxx
    M->>S: Điền thông tin → POST /api/auth/register
    S->>S: Verify invite code, tạo User(role=MEMBER)
    S-->>M: Access token → redirect Home
```

### 6.2 Upload & Duyệt tư liệu

```mermaid
sequenceDiagram
    participant M as Member
    participant S as Backend
    participant ST as S3/MinIO
    participant AR as Archivist

    M->>S: POST /api/media/upload (file + metadata)
    S->>ST: Upload file → get fileKey
    S->>S: Create Media(state=PENDING)
    S-->>M: 201 Created

    AR->>S: GET /api/media?state=PENDING
    S-->>AR: Danh sách chờ duyệt
    AR->>S: PATCH /api/media/:id/approve
    S->>S: Update state=PUBLISHED, log audit
    S-->>AR: 200 OK
```

### 6.3 Xem cây gia phả (với Privacy Filter)

```mermaid
sequenceDiagram
    participant U as Member
    participant FE as Frontend
    participant BE as ClanHub API
    participant GW as Gramps Web API

    U->>FE: Mở /tree
    FE->>BE: GET /api/genealogy/tree (Bearer token)
    BE->>BE: Verify JWT, extract role
    BE->>GW: GET /api/people (Gramps API)
    GW-->>BE: Raw people data
    BE->>BE: Apply privacy filter (hide living details for MEMBER)
    BE-->>FE: Filtered tree data
    FE->>FE: Render tree (D3.js)
```

---

## 7. Bảo mật & Cross-cutting concerns

| Concern | Giải pháp |
|---|---|
| **Authentication** | JWT (15min access + 7d refresh), httpOnly cookie cho refresh |
| **Authorization** | RBAC middleware kiểm tra `user.role` vs. endpoint requirement |
| **Privacy** | Server-side filter cho living persons; FE hiển thị badge "hidden" |
| **Rate Limiting** | `express-rate-limit`: 100 req/min general, 5 req/min cho login |
| **Input Validation** | Zod schemas validate ở cả FE form và BE controller |
| **CORS** | Whitelist FE origin |
| **Password** | argon2 hash, min 8 chars |
| **File Upload** | Giới hạn 10MB/file, chỉ cho phép jpg/png/pdf, scan malware (optional) |
| **Signed URLs** | Media files truy cập qua pre-signed S3 URLs (expire 1h) |
| **Audit** | Async log mọi mutation action (create/update/delete/export) |
| **HTTPS** | TLS via Caddy/Nginx reverse proxy |

---

## 8. Deployment Architecture

```mermaid
graph TB
    subgraph Server["VPS (Docker Compose)"]
        RP["Caddy / Nginx<br/>Reverse Proxy<br/>:443"]
        FE["Next.js Container<br/>:3000"]
        BE["Express Container<br/>:4000"]
        GW["Gramps Web Container<br/>:5000"]
        PG["PostgreSQL<br/>:5432"]
        MC["MinIO<br/>:9000"]
    end

    Internet["Internet"] --> RP
    RP -->|/| FE
    RP -->|/api| BE
    BE --> PG
    BE --> MC
    BE -->|internal| GW
```

**Docker Compose services:**
1. `frontend` — Next.js production build
2. `backend` — Express API
3. `grampsweb` — Gramps Web official image
4. `postgres` — PostgreSQL 16
5. `minio` — MinIO (S3-compatible storage)
6. `caddy` — Reverse proxy + auto TLS

---

## 9. Milestones & Ước lượng

| Milestone | Nội dung | Thời gian |
|---|---|---|
| **M1** | Setup monorepo, Docker Compose, DB schema, Auth module (register/login/invite/RBAC) | 2 tuần |
| **M2** | Genealogy proxy + Gramps Web integration + Tree view + Person profile + Privacy filter | 2–3 tuần |
| **M3** | Media library + S3 upload + Approval flow + Tag to person | 2 tuần |
| **M4** | Audit log + Backup/Export + Admin pages + Production deploy | 1–2 tuần |
| **Tổng** | | **7–9 tuần** |

### Chi tiết milestone

#### M1 — Auth & Setup (2 tuần)
- [BE] Khởi tạo project Express + TypeScript + Prisma
- [BE] Prisma schema → migrate PostgreSQL
- [BE] Auth module: register, login, refresh, logout, forgot/reset password
- [BE] User module: CRUD, invite link, RBAC middleware
- [BE] Rate limit, CORS, error handler, logging
- [FE] Khởi tạo Next.js + shadcn/ui + Tailwind
- [FE] Login, Register, Forgot Password pages
- [FE] Layout: Sidebar + Header + Auth guard
- [FE] Admin Users page (bảng user, tạo invite)
- [Infra] Docker Compose: postgres, minio, backend, frontend

#### M2 — Genealogy Core (2–3 tuần)
- [Infra] Thêm Gramps Web container vào Docker Compose
- [BE] Genealogy proxy module: forward calls to Gramps API
- [BE] Privacy filter middleware cho living persons
- [FE] Tree View page: D3.js canvas, zoom/pan, search
- [FE] People List page: search, filter, pagination
- [FE] Person Profile page: tabs (Overview, Relationships, Media, Sources, History)
- [FE] Living Privacy UI: badge, hidden fields
- [BE] Import GEDCOM (optional — nhập dữ liệu ban đầu)

#### M3 — Media Library (2 tuần)
- [BE] Media module: upload → S3, create record, link to person
- [BE] Approval flow: pending → approved/rejected
- [BE] Signed URL generation cho media access
- [FE] Media Library page: grid view, filter, upload modal
- [FE] Media Viewer component
- [FE] Pending queue cho Archivist/Admin
- [FE] Tích hợp media vào Person Profile tab

#### M4 — Audit & Backup (1–2 tuần)
- [BE] Audit log service: auto-log mutations via middleware
- [BE] Backup module: export GEDCOM (gọi Gramps API), DB snapshot (pg_dump), upload S3
- [FE] Audit Log page: bảng filter + pagination
- [FE] Backup page: trigger export, list backups, download
- [Infra] Production docker-compose, Caddy TLS, deploy script
- [QA] End-to-end testing các luồng chính

---

## 10. Quy ước & Standards

### 10.1 API Convention
- RESTful, prefix `/api`
- Response format: `{ success: boolean, data?: T, error?: { code, message } }`
- Pagination: `?page=1&limit=20` → response `{ data, meta: { total, page, limit, totalPages } }`
- Date format: ISO 8601 (`2026-02-19T18:00:00+07:00`)
- Error codes: HTTP standard + custom business codes

### 10.2 Git & Code
- Monorepo: `frontend/`, `backend/`, `docker/`, `docs/`
- Branch: `main` → `develop` → `feature/xxx`
- Commit: Conventional Commits (`feat:`, `fix:`, `chore:`)
- Lint: ESLint + Prettier (shared config)

### 10.3 Environment Variables
```env
# Backend
DATABASE_URL=postgresql://user:pass@postgres:5432/clanhub
JWT_SECRET=xxx
JWT_REFRESH_SECRET=xxx
GRAMPS_WEB_URL=http://grampsweb:5000
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
S3_BUCKET=clanhub-media
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=http://localhost:3000
```

---

## 11. Verification Plan

### 11.1 Automated Tests
- **Backend**: Jest unit tests cho mỗi service module
  - Auth: register, login, refresh, RBAC guard
  - Genealogy proxy: privacy filter logic
  - Media: upload flow, approval state transitions
  - Audit: log creation, query
  - Command: `cd backend && npm test`
- **Frontend**: Vitest + React Testing Library
  - Component render tests
  - Form validation tests
  - Command: `cd frontend && npm test`

### 11.2 Manual Verification
- **Luồng invite → đăng ký → đăng nhập** chạy trơn tru
- **RBAC**: Member không thấy admin pages, Editor có thể sửa gia phả, Guest bị giới hạn
- **Privacy**: Đăng nhập Member → mở profile người còn sống → xác nhận thông tin bị ẩn
- **Tree view**: render đúng quan hệ, click vào node → đúng profile
- **Media**: upload ảnh → pending → Archivist duyệt → published → hiển thị trong profile
- **Audit**: mọi thao tác sửa đổi → check audit log page
- **Export**: Admin export GEDCOM → file tải thành công

> Verification chi tiết sẽ được bổ sung khi bắt đầu từng milestone.

---

## 12. Rủi ro & Giảm thiểu (Phase 1)

| Rủi ro | Mức độ | Giảm thiểu |
|---|---|---|
| Gramps Web API thay đổi version | Trung bình | Pin version Docker image, proxy layer cách ly |
| Tree view performance với gia phả lớn | Thấp (Phase 1 nhỏ) | Pagination, lazy load, virtual canvas |
| Media storage cost | Thấp | MinIO self-hosted, limit file size |
| Privacy leak | Cao | Server-side filter bắt buộc, FE chỉ là lớp hiển thị phụ |
| Single point of failure | Trung bình | Docker health checks, backup daily |
