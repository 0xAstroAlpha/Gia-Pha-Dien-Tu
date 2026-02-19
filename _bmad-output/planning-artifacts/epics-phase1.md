---
stepsCompleted: [validate-prerequisites, design-epics, create-stories, final-validation]
inputDocuments:
  - prd (1).md
  - PlanPhase1.md
  - _bmad-output/planning-artifacts/architecture.md
---

# ClanHub Phase 1 — Epic Breakdown

## Overview

Tài liệu này chia nhỏ yêu cầu Phase 1 (Single-tenant MVP cho dòng họ Lê Huy) thành các Epic và User Story có thể implement được. Mỗi story có Acceptance Criteria theo format Given/When/Then.

## Requirements Inventory

### Functional Requirements

- **FR-1:** Đăng nhập / Đăng ký qua invite code
- **FR-2:** Phân quyền RBAC (Admin, Editor, Archivist, Member, Guest)
- **FR-3:** Quản lý user & invite links
- **FR-4:** Xem cây gia phả (tree view) — proxy từ Gramps Web
- **FR-5:** Xem danh sách người (people list) + search/filter
- **FR-6:** Xem hồ sơ cá nhân (person profile) với tabs
- **FR-7:** Bảo vệ quyền riêng tư người còn sống (Living Privacy)
- **FR-8:** Upload media (ảnh/tài liệu) + link to person
- **FR-9:** Quy trình duyệt media (pending → approved/rejected)
- **FR-10:** Audit log cho mọi thao tác
- **FR-11:** Backup & export (GEDCOM + DB snapshot)

### NonFunctional Requirements

- **NFR-1:** Response time < 500ms (API endpoints)
- **NFR-2:** Support 50 concurrent users (Phase 1)
- **NFR-3:** File upload ≤ 10MB, jpg/png/pdf only
- **NFR-4:** HTTPS (auto TLS via Caddy)
- **NFR-5:** Docker Compose deployment

### FR Coverage Map

| FR | Epic |
|---|---|
| FR-1, FR-2, FR-3 | Epic 1: Auth & User Management |
| FR-4, FR-5, FR-6, FR-7 | Epic 2: Genealogy Core |
| FR-8, FR-9 | Epic 3: Media Library |
| FR-10, FR-11 | Epic 4: Audit & Backup |
| NFR-1..5 | Epic 0: Project Setup & Infra |

## Epic List

- **Epic 0:** Project Setup & Infrastructure
- **Epic 1:** Authentication & User Management
- **Epic 2:** Genealogy Core (Tree, People, Privacy)
- **Epic 3:** Media Library & Approval
- **Epic 4:** Audit Log & Backup/Export

---

## Epic 0: Project Setup & Infrastructure

Thiết lập monorepo, Docker Compose, CI/CD, và cấu hình cơ bản cho toàn bộ dự án.

### Story 0.1: Initialize Monorepo Structure

As a **developer**,
I want a clean monorepo structure with frontend and backend projects,
So that the team can develop in an organized, consistent codebase.

**Acceptance Criteria:**

**Given** monorepo chưa tồn tại
**When** chạy script init
**Then** có cấu trúc thư mục: `frontend/`, `backend/`, `docker/`, `docs/`
**And** ESLint + Prettier config được share qua root
**And** `package.json` root có scripts: `dev`, `build`, `lint`
**And** TypeScript config (tsconfig) cho cả FE & BE

### Story 0.2: Setup Backend Express + TypeScript + Prisma

As a **developer**,
I want a configured Express.js backend with TypeScript and Prisma,
So that I can start building API modules immediately.

**Acceptance Criteria:**

**Given** backend folder trống
**When** init project
**Then** Express.js app chạy tại port 4000
**And** Prisma connected to PostgreSQL
**And** module structure: `src/config/`, `src/middleware/`, `src/modules/`, `src/shared/`
**And** Pino logger configured
**And** `.env.example` có tất cả biến cần thiết

### Story 0.3: Setup Frontend Next.js + shadcn/ui + Tailwind

As a **developer**,
I want a configured Next.js 15 frontend with shadcn/ui and Tailwind CSS,
So that I can build UI components following the design system.

**Acceptance Criteria:**

**Given** frontend folder trống
**When** init project
**Then** Next.js 15 App Router hoạt động tại port 3000
**And** shadcn/ui installed với button, input, card, dialog, table components
**And** Tailwind CSS v4 configured
**And** Layout components: Sidebar + Header skeleton
**And** Dark/Light theme toggle hoạt động
**And** Inter font loaded from Google Fonts

### Story 0.4: Docker Compose Full Stack

As a **developer**,
I want Docker Compose config for all services,
So that the entire stack can run with one command.

**Acceptance Criteria:**

**Given** Dockerfiles cho FE và BE
**When** chạy `docker compose up`
**Then** 6 services chạy: frontend, backend, grampsweb, postgres, minio, caddy
**And** Caddy proxy: `/` → frontend, `/api` → backend
**And** Health checks cho tất cả services
**And** Volumes persist data: postgres, minio, gramps

---

## Epic 1: Authentication & User Management

Register, Login, RBAC, Invite system — nền tảng IAM cho toàn Phase 1.

### Story 1.1: User Registration via Invite Code

As a **family member** được mời,
I want to register an account using an invite code,
So that I can access the family genealogy platform.

**Acceptance Criteria:**

**Given** admin đã tạo invite link
**When** member mở link `/register?code=xxx` và điền form (email, password, display name)
**Then** tài khoản mới được tạo với role từ invite link
**And** invite `usedCount` tăng lên 1
**And** nếu invite hết số lượng dùng → báo lỗi "Invite code expired"
**And** password được hash bằng argon2
**And** trả về access token + refresh token

### Story 1.2: Login / Logout / Token Refresh

As a **registered user**,
I want to login and maintain my session securely,
So that I can access the platform without re-entering credentials.

**Acceptance Criteria:**

**Given** user có tài khoản active
**When** POST `/api/auth/login` với email + password đúng
**Then** trả về access token (15min) + refresh token (7d, httpOnly cookie)
**And** refresh token được lưu vào DB

**Given** access token hết hạn
**When** POST `/api/auth/refresh` với refresh token hợp lệ
**Then** trả về access token mới

**Given** user muốn logout
**When** POST `/api/auth/logout`
**Then** refresh token bị xóa khỏi DB

### Story 1.3: Forgot & Reset Password

As a **user** quên mật khẩu,
I want to reset my password via email,
So that I can regain access to my account.

**Acceptance Criteria:**

**Given** user nhập email đã đăng ký
**When** POST `/api/auth/forgot-password`
**Then** email reset link được gửi (Nodemailer/Resend)
**And** reset token có thời hạn 1 giờ

**Given** user có reset token hợp lệ
**When** POST `/api/auth/reset-password` với token + new password
**Then** password được cập nhật
**And** reset token bị vô hiệu hóa

### Story 1.4: RBAC Middleware

As a **system**,
I want role-based access control on all API endpoints,
So that users only access features matching their role level.

**Acceptance Criteria:**

**Given** RBAC middleware được cấu hình
**When** request tới endpoint yêu cầu Admin role từ user có role Member
**Then** trả về 403 Forbidden

**Given** hierarchy: Admin > Editor > Archivist > Member > Guest
**When** user có role Editor gọi endpoint yêu cầu Member+
**Then** request được cho phép

### Story 1.5: Admin — User Management & Invite Links

As an **admin**,
I want to manage users and create invite links,
So that I can control who has access to the platform.

**Acceptance Criteria:**

**Given** admin đăng nhập
**When** GET `/api/users`
**Then** trả về danh sách tất cả users với role, status, createdAt

**When** POST `/api/users/invite` với `{ role, maxUses, expiresAt }`
**Then** trả về invite link URL có unique code

**When** PATCH `/api/users/:id/role` với `{ role: "EDITOR" }`
**Then** user được đổi role

**When** PATCH `/api/users/:id/status` với `{ status: "SUSPENDED" }`
**Then** user bị suspend, token bị vô hiệu hóa

### Story 1.6: Frontend — Auth Pages & Layout

As a **user**,
I want login, register, and forgot password pages,
So that I can authenticate on the platform.

**Acceptance Criteria:**

**Given** user chưa đăng nhập
**When** truy cập bất kỳ trang (main) nào
**Then** redirect tới `/login`

**Given** user ở trang `/login`
**When** nhập email + password đúng và submit
**Then** redirect tới Home dashboard

**Given** user đăng nhập thành công
**When** mở ứng dụng
**Then** thấy layout: Sidebar (navigation) + Header (user info, theme toggle) + Content area
**And** sidebar collapse trên mobile

### Story 1.7: Frontend — Admin Users Page

As an **admin**,
I want a user management page in the admin section,
So that I can manage members and invites visually.

**Acceptance Criteria:**

**Given** admin đăng nhập và vào `/admin/users`
**When** trang load
**Then** hiển thị bảng users có columns: Name, Email, Role, Status, Joined
**And** có nút "Create Invite Link" mở dialog
**And** có action dropdown trên mỗi row: Change Role, Suspend/Activate

---

## Epic 2: Genealogy Core (Tree, People, Privacy)

Proxy Gramps Web API, hiển thị cây gia phả, danh sách người, hồ sơ cá nhân với privacy filter.

### Story 2.1: Genealogy Proxy Module

As a **system**,
I want a proxy layer between ClanHub BE and Gramps Web API,
So that all genealogy data flows through ClanHub with auth and privacy checks.

**Acceptance Criteria:**

**Given** Gramps Web container đang chạy
**When** GET `/api/genealogy/people`
**Then** BE gọi Gramps Web API `/api/people`, áp dụng privacy filter, trả về kết quả

**Given** user có role Editor
**When** PUT `/api/genealogy/people/:handle`
**Then** BE forward update request tới Gramps Web API
**And** audit log được tạo

### Story 2.2: Privacy Filter for Living Persons

As a **system**,
I want server-side filtering of living person data based on user role,
So that privacy of alive family members is protected.

**Acceptance Criteria:**

**Given** person chưa mất (`death === null && !deceased`)
**When** user role = Member request person detail
**Then** chỉ trả về fields theo `PrivacyConfig.memberCanSee` (default: name, birthYear)
**And** response có `_privacyNote: "Thông tin bị ẩn..."`

**Given** person đã mất
**When** bất kỳ user nào request
**Then** trả về toàn bộ thông tin

**Given** user role = Admin
**When** request living person detail
**Then** trả về toàn bộ thông tin (adminCanSee = ["*"])

### Story 2.3: Frontend — Tree View Page

As a **family member**,
I want to see the family tree as an interactive chart,
So that I can explore relationships visually.

**Acceptance Criteria:**

**Given** user đăng nhập và vào `/tree`
**When** trang load
**Then** cây gia phả được render bằng D3.js (hoặc React Flow)
**And** hỗ trợ zoom, pan, search to jump

**When** click vào 1 node
**Then** mở person profile page

**And** có 3 chế độ: Ancestor, Descendant, Hourglass

### Story 2.4: Frontend — People List Page

As a **family member**,
I want to browse and search all people in the genealogy,
So that I can find specific family members quickly.

**Acceptance Criteria:**

**Given** user vào `/people`
**When** trang load
**Then** hiển thị danh sách people có: tên, năm sinh/mất, giới tính
**And** có search bar (tìm theo tên)
**And** filter: giới tính, còn sống/đã mất
**And** pagination

### Story 2.5: Frontend — Person Profile Page

As a **family member**,
I want to view detailed information about a specific person,
So that I can learn about their life and relationships.

**Acceptance Criteria:**

**Given** user vào `/people/[handle]`
**When** trang load
**Then** hiển thị tabs: Overview, Relationships, Media, Sources, History

**Given** person là người còn sống và user role = Member
**Then** badge "🔒 Thông tin bị giới hạn" hiển thị
**And** chỉ hiển thị fields cho phép

---

## Epic 3: Media Library & Approval

Upload media, approval workflow, gắn media vào person, hiển thị trong library.

### Story 3.1: Media Upload API

As a **member**,
I want to upload photos and documents,
So that I can contribute to the family archive.

**Acceptance Criteria:**

**Given** user đăng nhập (role ≥ Member)
**When** POST `/api/media/upload` với file + metadata (title, description, date, linkedPersonId)
**Then** file được upload lên S3/MinIO
**And** record Media(state=PENDING) được tạo
**And** audit log ghi nhận upload

**And** file > 10MB → trả về 413 Payload Too Large
**And** file type không phải jpg/png/pdf → trả về 415 Unsupported Media Type

### Story 3.2: Media Approval Workflow

As an **archivist**,
I want to review and approve/reject uploaded media,
So that only quality content is published in the library.

**Acceptance Criteria:**

**Given** archivist vào GET `/api/media?state=PENDING`
**Then** thấy danh sách media chờ duyệt

**When** PATCH `/api/media/:id/approve`
**Then** state chuyển PENDING → PUBLISHED
**And** audit log ghi nhận

**When** PATCH `/api/media/:id/reject`
**Then** state chuyển PENDING → REJECTED
**And** audit log ghi nhận

### Story 3.3: Signed URL for Media Access

As a **user**,
I want to view media files securely,
So that files are not publicly accessible.

**Acceptance Criteria:**

**Given** media state = PUBLISHED
**When** GET `/api/media/:id`
**Then** response chứa signed URL (expire 1h) để download/view

### Story 3.4: Frontend — Media Library Page

As a **family member**,
I want to browse the media library,
So that I can view family photos and documents.

**Acceptance Criteria:**

**Given** user vào `/media`
**When** trang load
**Then** hiển thị grid view ảnh/tài liệu (thumbnails)
**And** filter: state (published), person linked, date

**And** nút "Upload" mở modal: drag & drop + metadata form
**And** click ảnh → viewer với signed URL

### Story 3.5: Frontend — Pending Queue (Archivist)

As an **archivist/admin**,
I want to see and manage pending media,
So that I can keep the library curated.

**Acceptance Criteria:**

**Given** archivist/admin vào `/media` tab "Chờ duyệt"
**When** trang load
**Then** hiển thị list media PENDING
**And** có nút Approve / Reject trên mỗi item

---

## Epic 4: Audit Log & Backup/Export

Ghi nhận mọi thao tác chỉnh sửa, export GEDCOM & DB snapshot.

### Story 4.1: Audit Log Service

As a **system**,
I want to automatically log all mutation actions,
So that there is a complete audit trail of changes.

**Acceptance Criteria:**

**Given** audit middleware được cài đặt
**When** bất kỳ mutation API nào thực thi thành công (CREATE, UPDATE, DELETE, EXPORT)
**Then** AuditLog record được tạo (async) với: actorId, action, entityType, entityId, diffSummary, ipAddress

### Story 4.2: Frontend — Audit Log Page

As an **admin/editor**,
I want to view the audit log,
So that I can track all changes made to the system.

**Acceptance Criteria:**

**Given** admin vào `/admin/audit`
**When** trang load
**Then** hiển thị bảng audit log: Actor, Action, Entity, Date
**And** filter: actor, action type, entity type, date range
**And** pagination

### Story 4.3: Backup — GEDCOM Export

As an **admin**,
I want to export genealogy data as GEDCOM,
So that I have a portable backup of the family tree.

**Acceptance Criteria:**

**Given** admin
**When** POST `/api/backup/export/gedcom`
**Then** GEDCOM file được generate (gọi Gramps Web API export)
**And** file được upload lên S3
**And** BackupRecord được tạo
**And** audit log ghi nhận

### Story 4.4: Backup — DB Snapshot

As an **admin**,
I want to create a database snapshot,
So that I can restore the system if needed.

**Acceptance Criteria:**

**Given** admin
**When** POST `/api/backup/snapshot`
**Then** pg_dump được thực thi
**And** dump file upload lên S3
**And** BackupRecord được tạo

### Story 4.5: Frontend — Backup Page

As an **admin**,
I want a backup management page,
So that I can trigger and download backups.

**Acceptance Criteria:**

**Given** admin vào `/admin/backup`
**When** trang load
**Then** hiển thị danh sách BackupRecords: Type, Size, Date, Download
**And** nút "Export GEDCOM" trigger API
**And** nút "DB Snapshot" trigger API
**And** download link dùng signed URL

### Story 4.6: Production Deployment

As a **developer/admin**,
I want production-ready Docker Compose setup,
So that the platform can be deployed securely.

**Acceptance Criteria:**

**Given** production config
**When** deploy lên VPS
**Then** Caddy auto-TLS hoạt động
**And** tất cả services healthy
**And** environment variables loaded từ `.env`
**And** daily backup cron configured
