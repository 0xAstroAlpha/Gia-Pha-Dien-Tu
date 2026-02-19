# PRD — Gia Phả & Cộng Đồng Dòng Họ (Base: Gramps Web)
**Tên dự án (working name):** ClanHub (GiaPhaHub)  
**Phiên bản PRD:** v1.0  
**Ngày:** 2026-02-19  
**Múi giờ:** Asia/Bangkok  

> Mục tiêu: xây dựng sản phẩm dựa trên nền tảng **Gramps Web** (genealogy core) và mở rộng thành hệ thống **kết nối cộng đồng dòng họ**, đi theo 3 giai đoạn:
> 1) MVP cho **một dòng họ Lê Huy** (single-tenant)
> 2) Mở rộng **tính năng cộng đồng** (community layer)
> 3) Nâng cấp thành **SaaS đa dòng họ** (multi-tenant + domain riêng)

---

## 0) Tóm tắt sản phẩm
### 0.1. Vấn đề
- Gia phả thường nằm rải rác (file GEDCOM, giấy tờ, ảnh), khó cộng tác cập nhật.
- Thiếu lớp “cộng đồng”: thông báo, sự kiện, nhóm theo chi họ, kết nối thành viên, chia sẻ tư liệu.
- Khi mở rộng sang nhiều dòng họ, cần tách dữ liệu, phân quyền, domain/branding và vận hành dạng SaaS.

### 0.2. Giải pháp
- **Genealogy Core**: tận dụng Gramps Web để hiển thị & chỉnh sửa gia phả có kiểm soát.
- **Community Layer**: thêm feed, nhóm, sự kiện, thư viện tư liệu, công cụ kết nối thành viên.
- **SaaS Layer**: multi-tenant isolation, custom domain, billing/plan, admin console.

### 0.3. Nguyên tắc thiết kế
- Privacy-first (đặc biệt dữ liệu người còn sống).
- Cộng tác có kiểm soát (role/permission + audit log).
- Portability (export/backup rõ ràng).
- Mở rộng theo giai đoạn: phase 1 đơn tenant nhưng đặt nền migration lên SaaS.

---

## 1) Phạm vi theo 3 giai đoạn

### Giai đoạn 1 — “Lê Huy Only” (Single-tenant MVP)
**Mục tiêu:** chạy ổn cho *một* dòng họ, tập trung “gia phả + kho tư liệu + phân quyền + onboarding”.  
**Outcome:** 1 website cho dòng họ Lê Huy, mời thành viên vào xem/cập nhật.

**In-scope**
- Đăng nhập/tài khoản, mời thành viên, role cơ bản.
- Gia phả: browse tree, person profile, family view; edit hạn chế cho editor.
- Privacy người còn sống (ẩn thông tin nhạy cảm theo quyền).
- Media & tư liệu: upload ảnh/scan; tag vào người/sự kiện.
- Audit log cho thao tác chỉnh sửa.
- Backup & export dữ liệu (ít nhất: export GEDCOM + backup DB).

**Out-of-scope (để phase 2/3)**
- News feed/social, chat, nhóm chi họ.
- Lịch sự kiện + RSVP.
- Multi-tenant, domain riêng, billing.

---

### Giai đoạn 2 — “Cộng đồng dòng họ” (Community Layer)
**Mục tiêu:** biến site thành “mạng nội bộ dòng họ”: tin tức, sự kiện, nhóm, kết nối thành viên.

**In-scope**
- News Feed (bài viết, ảnh, story), comment/reaction.
- Nhóm theo chi họ/khu vực (channels).
- Sự kiện: lịch dòng họ + RSVP + nhắc sinh nhật/giỗ/kỷ niệm.
- Member Directory: hồ sơ thành viên + đề xuất kết nối.
- Moderation: report, duyệt nội dung (role moderator).

**Out-of-scope (để phase 3)**
- Multi-tenant SaaS, admin console platform, custom domain self-serve, billing.

---

### Giai đoạn 3 — “SaaS đa dòng họ” (Multi-tenant + Domain riêng)
**Mục tiêu:** phục vụ nhiều khách hàng/dòng họ; mỗi tenant tách dữ liệu & có domain riêng.

**In-scope**
- Multi-tenant architecture (isolation dữ liệu + media).
- Tenant management: tạo tenant, branding, quota.
- Domain riêng: subdomain mặc định + custom domain (verify DNS, TLS).
- Billing/plan (nếu thương mại hóa).
- Platform admin console (ops, backup, suspend).
- Migrator: chuyển từ single-tenant (phase1/2) sang tenant (phase3).

---

## 2) Personas & Use cases
### 2.1 Personas
1) **Trưởng họ / Ban quản trị**
- Cần quản lý thành viên, phân quyền, duyệt thông tin, thông báo & sự kiện.

2) **Archivist (quản tư liệu)**
- Upload/chuẩn hóa tư liệu, gắn nguồn, gắn tag vào người/sự kiện.

3) **Editor (người cập nhật gia phả)**
- Thêm/sửa người, quan hệ, ngày tháng, nguồn.

4) **Member (thành viên bình thường)**
- Tra cứu quan hệ, xem tin, tham gia sự kiện, đóng góp tư liệu.

5) **Guest (khách mời)**
- Chỉ xem nội dung công khai trong tenant (tùy cấu hình).

### 2.2 Use cases tiêu biểu
- “Tôi muốn tìm mình thuộc chi nào, liên kết họ hàng ra sao.”
- “Tôi muốn upload ảnh giấy khai sinh của ông nội và gắn vào hồ sơ.”
- “Trưởng họ muốn thông báo họp họ và thu RSVP.”
- “Moderator duyệt bài và xử lý report.”

---

## 3) Yêu cầu chức năng (Functional Requirements)

### 3.1. Identity & Access
**Phase 1**
- Đăng ký bằng invite link (mặc định), hoặc admin tạo tài khoản.
- Đăng nhập email + password.
- Reset password.
- Role tối thiểu:
  - Owner/Admin
  - Editor
  - Archivist
  - Member
  - Guest (optional)

**Phase 2**
- Moderator role.
- Group-level permissions (nhóm chi họ).

**Phase 3**
- Global account (1 user có thể thuộc nhiều tenant) *hoặc* account tách theo tenant (config).
- SSO/OIDC cho tenant lớn (optional).

### 3.2. Genealogy Core (kế thừa Gramps Web)
- Tree browsing (family/person view).
- Person profile: thông tin cơ bản, quan hệ, media, sources.
- Edit (theo quyền): add person, link family, merge (tùy).
- Import/Export:
  - Import GEDCOM/Gramps XML (phase 1 optional nếu cần nhập dữ liệu có sẵn)
  - Export GEDCOM

### 3.3. Privacy người còn sống (Living Privacy)
- Rule mặc định:
  - Member: thấy tên + năm sinh (ẩn chi tiết nhạy cảm)
  - Editor/Archivist: thấy nhiều hơn (config)
  - Admin: full access
- UI hiển thị “hidden due to privacy” thay vì blank.

### 3.4. Media & Archive Library
**Phase 1**
- Upload ảnh/scan (jpg/png/pdf), giới hạn size theo cấu hình.
- Tổ chức theo:
  - People (gắn vào person)
  - Event (gắn vào sự kiện đời người: sinh, mất, cưới)
  - Place (optional)
- Metadata: title, description, date, uploader.
- Quy trình:
  - Member upload -> state = pending (optional)
  - Archivist/Admin approve -> state = published

**Phase 2**
- Album theo sự kiện dòng họ.
- Tìm kiếm theo tag (chi họ, địa điểm, năm).

### 3.5. Audit log & Versioning
**Phase 1**
- Log: ai sửa gì, khi nào, entity nào (person/family/media).
- Trang “History” cho Admin/Editor.

**Phase 2**
- Activity feed (internal): sự kiện hệ thống + bài viết.

### 3.6. Community Layer (Phase 2)
#### 3.6.1 News Feed
- Post types: Announcement, Story, Question, Archive Drop.
- Comment, reaction.
- Mention/tag người.
- Pin post quan trọng.

#### 3.6.2 Groups/Branches
- Tạo group theo chi họ/khu vực.
- Bài viết & sự kiện có thể “thuộc group”.
- Quyền: group admin/moderator.

#### 3.6.3 Events & Calendar
- Calendar tenant: tạo sự kiện (họp họ/giỗ tổ).
- RSVP + số lượng.
- Reminder:
  - Sinh nhật
  - Ngày giỗ
  - Kỷ niệm
- Notification (email/in-app).

#### 3.6.4 Member Directory & Connection
- Directory: tên, chi họ, địa phương, liên hệ (ẩn theo privacy).
- “Bạn nên kết nối” (suggestion rules cơ bản):
  - cùng chi họ
  - liên quan gần trong tree (N steps)
  - cùng địa phương

### 3.7. SaaS Layer (Phase 3)
#### 3.7.1 Multi-tenant
- Tenant tạo mới từ admin console hoặc self-serve.
- Data isolation:
  - Option A: DB per tenant (ưu tiên cách ly)
  - Option B: shared DB + tenant_id (tối ưu cost)
- Media isolation:
  - bucket/folder theo tenant + signed URL.

#### 3.7.2 Domain riêng
- Default: `{tenant}.yourapp.com`
- Custom domain:
  - verify DNS (TXT/CNAME)
  - auto TLS
  - enforce HTTPS
- Branding:
  - logo, theme color, landing page.

#### 3.7.3 Billing (optional)
- Plan: Free/Standard/Pro
- Quota: users, storage, features (custom domain, SSO).
- Invoices & payment provider.

#### 3.7.4 Platform Admin Console
- Tenant list, suspend/restore.
- Quota usage, storage usage.
- Backup status, export per tenant.
- Logs & health metrics.

---

## 4) Yêu cầu phi chức năng (Non-functional)
- **Bảo mật**: TLS, password hashing, rate limit, RBAC.
- **Privacy**: mặc định khóa; không index public search; export có cảnh báo.
- **Hiệu năng**: tree browse < 1.5s median (tenant vừa), search < 2s.
- **Khả dụng**: 99.5%+ (phase 3).
- **Backup**: snapshot hàng ngày; restore drill hàng tháng (phase 3).
- **Tuân thủ**: cơ chế xóa/ẩn dữ liệu cá nhân theo yêu cầu (phase 3).

---

## 5) Kiến trúc đề xuất (High-level)
### 5.1. Thành phần
- **Frontend**: Web UI (có thể React/Next.js) bọc các màn Gramps Web + màn community.
- **Backend API**:
  - Gramps Web backend (genealogy)
  - Community service (posts, groups, events)
  - Tenant service (phase 3)
- **DB**:
  - Gramps DB (genealogy)
  - Community DB (posts/events)
- **Object Storage**: media files.
- **Search** (phase 2+): full-text / people search index (optional).

### 5.2. Chiến lược tích hợp với Gramps Web
- Option 1: Fork Gramps Web, thêm module (nhanh nhưng khó update upstream).
- Option 2: Giữ Gramps Web như “genealogy service”, build “Community app” riêng gọi API.
- Khuyến nghị:
  - Phase 1: minimal changes (Option 2 nhẹ) để ship nhanh.
  - Phase 2: build community service riêng.
  - Phase 3: tenant routing ở gateway + service layer.

---

## 6) Data model (tóm tắt)
### 6.1 Phase 1 (single-tenant)
- User(id, email, password_hash, role, status, created_at)
- Person(id, gramps_person_id, …) *(thuộc Gramps)*
- Media(id, file_key, title, description, linked_person_id?, state, uploader_id, created_at)
- AuditLog(id, actor_id, action, entity_type, entity_id, diff_summary, created_at)

### 6.2 Phase 2 (community)
- Post(id, author_id, type, body, media_refs[], group_id?, created_at)
- Comment(id, post_id, author_id, body, created_at)
- Reaction(id, post_id, user_id, type)
- Group(id, name, type, visibility, created_at)
- GroupMember(group_id, user_id, role)
- Event(id, title, start_at, end_at, location, group_id?, created_by)
- RSVP(event_id, user_id, status, guests_count)

### 6.3 Phase 3 (multi-tenant)
- Tenant(id, slug, name, plan, status, created_at)
- TenantDomain(tenant_id, domain, verified, tls_status)
- TenantBranding(tenant_id, logo_key, theme)
- Membership(tenant_id, user_id, role)
- Tất cả entity thêm `tenant_id` (hoặc DB per tenant).

---

## 7) Permission matrix (rút gọn)
| Hành động | Admin | Editor | Archivist | Moderator | Member | Guest |
|---|---:|---:|---:|---:|---:|---:|
| Xem gia phả | ✅ | ✅ | ✅ | ✅ | ✅ | (tùy) |
| Sửa gia phả | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Upload tư liệu | ✅ | ✅ | ✅ | ✅ | ✅ (pending) | ❌ |
| Duyệt tư liệu | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Đăng bài feed | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Duyệt/xóa bài | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Tạo sự kiện | ✅ | ✅ | ✅ | ✅ | ✅ (tùy) | ❌ |
| Quản lý thành viên | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 8) UX / IA (Information Architecture)
### Phase 1 — Site Lê Huy
- Home (giới thiệu + search nhanh)
- Tree
- People (search + list)
- Person Profile (tabs: Overview / Relationships / Media / Sources / History)
- Media Library
- Admin: Users / Roles / Audit Log / Backup

### Phase 2 — Community
- Feed
- Groups
- Events/Calendar
- Directory
- Notifications

### Phase 3 — SaaS
- Tenant switcher
- Tenant settings (brand/domain/quota)
- Platform admin (internal ops)

---

## 9) Analytics & Observability
**Core metrics**
- WAU/MAU theo tenant
- # edits genealogy / tuần
- # uploads media / tuần
- Event RSVP rate
- Content engagement (post/comment)

**Tech metrics**
- p95 latency endpoints
- storage usage
- error rate
- background job backlog (thumbnail, index, notifications)

---

## 10) Security & Privacy checklist
- RBAC enforced server-side.
- Privacy người còn sống: field-level filtering.
- Signed URLs cho media private.
- Rate-limit login + endpoints nhạy cảm.
- Audit log cho export/backup.
- Admin-only: export full tenant.

---

## 11) Rollout plan & Milestones

### Phase 1 (6–10 tuần, tùy team)
**M1**: Setup codebase + auth + role (2w)  
**M2**: Genealogy core integrate + privacy living (2–3w)  
**M3**: Media library + approval flow (2w)  
**M4**: Audit log + backup/export + production deploy (1–2w)  
**Exit criteria**
- 50–200 user dùng ổn trong dòng họ Lê Huy
- Import/export hoạt động
- Privacy không lộ dữ liệu người sống khi member thường truy cập

### Phase 2 (6–12 tuần)
**M5**: Feed + posts/comments/reactions (2–3w)  
**M6**: Groups + permissions (2–3w)  
**M7**: Events + RSVP + reminders (2–3w)  
**M8**: Directory + suggestion + moderation (2–3w)  
**Exit criteria**
- Có hoạt động cộng đồng hàng tuần
- Moderator xử lý report/duyệt nội dung được
- Reminder chạy ổn

### Phase 3 (8–16 tuần)
**M9**: Tenant model + isolation + migration (3–6w)  
**M10**: Domain routing + custom domain + TLS (2–4w)  
**M11**: Self-serve tenant onboarding + branding (2–4w)  
**M12**: Platform admin + backup per tenant + quota (1–2w)  
**M13 (optional)**: Billing + plans (2–4w)  
**Exit criteria**
- Onboard ít nhất 3 tenant mới độc lập
- Custom domain chạy ổn
- Backup/restore tenant-pass

---

## 12) Rủi ro & phương án
- **Fork vs upstream**: fork sâu khó cập nhật Gramps Web → ưu tiên tách service (Option 2).
- **Privacy**: lỗi lọt thông tin người sống → test cases + permission test automation.
- **Data migration**: chuyển single-tenant sang tenant → xây migrator sớm (phase 2 cuối).
- **Media storage cost**: hạn mức & lifecycle policy.
- **Genealogy conflicts**: nhiều editor sửa cùng lúc → lock/merge strategy tối thiểu (warning + last-write + audit).

---

## 13) Backlog (ưu tiên)
### Must-have (Phase 1)
- RBAC + invite
- Tree browse + person profile
- Privacy living
- Media upload + link to person
- Audit log + export/backup

### Should-have (Phase 2)
- Feed + groups + events
- Notifications
- Moderation

### Could-have (Phase 3)
- Custom domain self-serve
- Billing
- SSO/OIDC
- AI tagging (ảnh/địa điểm) — sau khi ổn privacy

---

## 14) Phụ lục — Acceptance criteria mẫu (Phase 1)
1) Member thường truy cập hồ sơ người còn sống:
- Không thấy số điện thoại/địa chỉ/giấy tờ
- Chỉ thấy mức info cho phép (config)
2) Editor tạo người mới + gắn quan hệ:
- Person xuất hiện đúng trên tree
- Audit log ghi lại action
3) Upload ảnh giấy tờ:
- File lưu đúng, xem bằng signed URL
- Nếu pending, chỉ Archivist/Admin thấy mục chờ duyệt
4) Export GEDCOM:
- File tải xuống thành công
- Có log export trong audit

---
