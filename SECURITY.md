# Security Posture — HostelGrievance

**Version**: 2.0  
**Date**: 2026-08-29  
**Application**: HostelGrievance — University Hostel Grievance Management System  
**Stack**: SvelteKit (CSR) + Hono (Node.js/TypeScript) + better-sqlite3  

---

## 1. Security Posture Summary

HostelGrievance implements a defense-in-depth, zero-trust architecture designed specifically for multi-tenant university residential environments. A comprehensive pre-deployment security review identified and successfully remediated **27 security findings** (F-01 through F-27) spanning Broken Object-Level Authorization (BOLA/IDOR), authentication bypasses, stored cross-site scripting (XSS), formula injection in exports, weak password hashing, session fixation, and resource exhaustion.

Every API request is subject to server-side authentication, role-based access control, cryptographic verification, and structured audit logging.

---

## 2. Architecture Overview

```
Browser (SvelteKit SPA, CSR only)
        │
        │  HTTPS (enforced by reverse proxy)
        ▼
Hono API (Node.js/TypeScript)
  ├── Global Body Size Guard (10 MB max)
  ├── CORS Allowlist Middleware (HOSTEL_ALLOWED_ORIGINS)
  ├── Security Headers Middleware (CSP, Nosniff, Frame-Options)
  ├── Double-Submit Cookie CSRF Protection (X-CSRF-Token)
  ├── Sliding Window Rate Limiting (Login, Grievances, Comments)
  ├── Routes:
  │   ├── /api/login (Rate-limited, bcrypt verification)
  │   ├── /api/logout (Server-side session destruction)
  │   ├── /api/me (Active session identity)
  │   ├── /api/users (Hierarchical RBAC, self-service profile & password)
  │   ├── /api/grievances (Anti-IDOR scoped by role & assigned warden)
  │   ├── /api/grievances/:id/comments (Ownership-gated discussion)
  │   ├── /api/grievances/:id/attachments (Owner-only uploads)
  │   ├── /api/grievances/:id/review (Student rating & solution photo verification)
  │   ├── /api/attachments/:id (Authorization-gated file streaming)
  │   ├── /api/notices (Hostel & global broadcast announcements)
  │   ├── /api/hostels (Hostel facility management)
  │   └── /api/audit-logs (Tamper-evident audit log surveillance & CSV export)
  └── Error Handler (Generic client messages; internal detail masking)
        │
        ▼
SQLite Database (better-sqlite3)
  ├── Parameterized SQL queries only (Zero SQL injection)
  ├── Foreign Key Constraints with ON DELETE CASCADE
  └── SHA-256 Hashed Session Tokens
        │
        ▼
Local Storage (uploads/)
  ├── Server-generated UUID filenames (Zero user path traversal)
  └── Automatic disk cleanup via deleteStoredFile()
```

---

## 3. Major Security Controls & Defenses

### 3.1 Zero-Trust Authorization & Anti-IDOR Protections (F-01, F-02, F-03, F-04, F-27)
- **Broken Object-Level Authorization (BOLA/IDOR)** has been systematically eradicated.
- Every grievance endpoint calls `assertCanViewGrievance(user, row, db)` before returning data, reading comments, or serving attachments.
- **Role Scoping**:
  - **Students**: Restricted exclusively to their own grievances, attachments, comments, and reviews (`row.student_id === user.id`).
  - **Wardens**: Scoped strictly to students assigned to them (`student.warden_id === user.id` or matching hostel). Wardens cannot view, modify, or delete students assigned to other wardens.
  - **Administrators**: Superuser oversight across all entities, with exclusive permission to delete grievances, hostels, and manage staff accounts.

### 3.2 Cryptographic Password Hashing & Timing Defense (F-06, F-23)
- Passwords are encrypted using **bcrypt** with **10 salt rounds** (~80–120ms computational cost per hash).
- Minimum password length is enforced server-side at **12 characters** (aligning with NIST SP 800-63B standards).
- Password changes invalidate all existing sessions via `deleteSessionsForUser()`, ensuring stolen tokens cannot persist after a credential reset.

### 3.3 Session Security & Token Hashing (F-07, F-08, F-09, F-10)
- **Token Entropy**: 32-byte cryptographically secure pseudorandom tokens (256-bit entropy) generated via `crypto.randomBytes(32)`.
- **Database Storage**: Session tokens are stored in the database as **SHA-256 hashes** (`tokenHash`), preventing session hijacking even if the database file is read in an offline dump.
- **Cookie Flags**:
  - `HttpOnly`: Prevents client-side scripts from reading the session token (mitigating XSS theft).
  - `SameSite=Strict`: Prevents cross-site cookie transmission for CSRF protection.
  - `Secure`: Enforced in production environments (`NODE_ENV === 'production'`).
  - `Max-Age`: 7-day TTL with server-side validation on every request and active sliding-window renewal.
- **Logout & Invalidation**: Calling `/api/logout` destroys the session record in the database immediately.

### 3.4 Double-Submit Cookie CSRF Protection (F-08)
- State-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a valid `X-CSRF-Token` header that matches the value in the `csrf_token` cookie.
- Rejects forged cross-origin requests before route handlers execute.

### 3.5 File Upload & Pipeline Security (F-13, F-14, F-17, F-25)
- **MIME Allowlist**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`.
- **Magic Byte Signature Verification**: Actual file bytes are inspected against known binary signatures (e.g. `\xFF\xD8\xFF` for JPEG, `\x89PNG` for PNG, `%PDF-` for PDF) to reject disguised executable scripts.
- **Random UUID File Names**: Files are saved on disk using server-generated UUIDs (`[uuid].[ext]`). User-supplied filenames are treated solely as display metadata and never touch the filesystem.
- **Path Traversal Protection**: Canonical path resolution (`path.resolve`) and boundary checks prevent directory traversal attacks (`../`).
- **Forced Download Disposition**: Files are served with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` to prevent inline browser script execution.
- **Disk Cleanup on Deletion**: Deleting a grievance or user automatically triggers `deleteStoredFile()` to remove physical files from the `uploads/` directory, preventing disk storage exhaustion.

### 3.6 XSS & Formula Injection Defenses (F-26)
- **HTML Auto-Escaping**: All frontend templates use native Svelte interpolation (`{content}`), preventing stored XSS injection. Raw `{@html}` tags have been eliminated from all user-generated content.
- **CSV Formula Injection Sanitization**: In `/api/audit-logs/export`, all cell values starting with spreadsheet formula control characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically escaped with a leading single quote (`'`) to prevent Formula Injection / CSV Injection attacks in Microsoft Excel and Google Sheets.

### 3.7 Security Headers & Network Hygiene (F-05, F-15)
All API responses include strict security headers:
- `X-Content-Type-Options: nosniff` (Prevents MIME sniffing)
- `X-Frame-Options: DENY` (Prevents clickjacking)
- `Referrer-Policy: strict-origin-when-cross-origin` (Prevents URL referrer leakage)
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (Disallows resource loading from API responses)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` (Disables unnecessary browser capabilities)
- `CORS`: Explicit domain allowlist via `HOSTEL_ALLOWED_ORIGINS` environment variable.

### 3.8 Rate Limiting & DoS Defenses (F-12, F-16)
- **Login Rate Limiter**: 10 attempts per minute per IP to mitigate automated credential brute-forcing.
- **Grievance Filing Limiter**: 20 grievances per hour per user.
- **Comment Posting Limiter**: 30 comments per hour per user.
- **Global Payload Limit**: 10 MB maximum request body size guard in `app.ts`.

### 3.9 Structured Audit Logging & Surveillance (F-19)
- All security-relevant actions (authentication successes/failures, authorization violations, account creations, status changes, and file uploads) are recorded in the `audit_logs` table and written as structured JSON to `stdout`.
- Sensitive fields (passwords, raw session tokens) are never included in log entries.

---

## 4. Authentication & Authorization Matrix

| Role | Grievances Scope | Comments Scope | Attachments Scope | Status Workflow | User Management |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **🎓 Student** | Own grievances only (List, View, Edit open) | Own grievances only | Own grievances only (Max 5, 5MB each) | Read-only; Submits post-resolution review & photo | Self profile & password update |
| **🏢 Warden** | Assigned students' grievances (List, View, Comment) | Any assigned grievance | View all assigned attachments | Transitions: Open ➔ In Progress ➔ Resolved | Manages assigned students only (Create, Room allocate, Delete) |
| **👑 Admin** | All grievances across all hostels (Full moderation) | Any grievance | View all attachments | Full update & permanent deletion authority | Complete CRUD on Students, Wardens, Admins & Hostels |

---

## 5. Input Validation Rules

| Field | Minimum | Maximum | Type / Constraint |
|---|---|---|---|
| Grievance Title | 5 characters | 200 characters | String (trimmed) |
| Grievance Description | 20 characters | 5000 characters | String (trimmed) |
| Grievance Category | — | — | Enum (Maintenance, Water, Electricity, Internet, Cleanliness, Room, Other) |
| Grievance Priority | — | — | Enum (low, medium, high, urgent) |
| Comment Body | 3 characters | 2000 characters | String (trimmed) |
| Review Rating | 1 | 5 | Integer |
| Review Feedback | 5 characters | 2000 characters | String (trimmed) |
| Email Address | 3 characters | 254 characters | RFC-5322 compliant email |
| Password | 12 characters | 1024 characters | String |
| Attachment File | > 0 bytes | 5 MB | Magic bytes validated (JPEG, PNG, GIF, WebP, PDF) |

---

## 6. Hardening Findings Register (F-01 to F-27)

| ID | Vulnerability / Finding | Severity | Remediated In | Verification Test |
|---|---|---|---|---|
| **F-01** | IDOR on `GET /api/grievances/:id` | CRITICAL | `src/server/routes/grievances.ts` | `student cannot read another student's grievance` |
| **F-02** | IDOR on `PATCH /api/grievances/:id` | CRITICAL | `src/server/routes/grievances.ts` | `student cannot PATCH another student's grievance` |
| **F-03** | IDOR on `GET /api/attachments/:id` | CRITICAL | `src/server/routes/attachments.ts` | `student cannot download another student's attachment` |
| **F-04** | IDOR on Grievance Comments | HIGH | `src/server/routes/grievances.ts` | `student cannot read/post comments on another student's grievance` |
| **F-05** | CORS Wildcard with Credentials | CRITICAL | `src/server/app.ts` | `allows trusted origin, rejects untrusted origin` |
| **F-06** | Unsalted SHA-256 Password Hashes | CRITICAL | `src/server/auth/passwords.ts` | Auth verification tests with bcrypt |
| **F-07** | Session Cookie Missing HttpOnly | HIGH | `src/server/auth/session.ts` | `session cookie has HttpOnly and SameSite attributes` |
| **F-08** | Session Cookie Missing SameSite / CSRF | HIGH | `src/server/middleware/csrf.ts` | `session cookie has SameSite=Strict` |
| **F-09** | Missing Server-Side Session Expiry Check | HIGH | `src/server/auth/session.ts` | `expired session is rejected` |
| **F-10** | Session Resumption After Logout | HIGH | `src/server/routes/auth.ts` | `logout destroys server-side session` |
| **F-11** | Internal Stack Trace Leakage in Errors | HIGH | `src/server/http/errors.ts` | `unexpected errors return generic message` |
| **F-12** | Missing Login Brute-Force Rate Limiting | HIGH | `src/server/middleware/ratelimit.ts` | `rate-limits login after 10 failed attempts` |
| **F-13** | Path Traversal via Stored Upload Name | HIGH | `src/server/storage/attachments.ts` | `handles path-traversal-style filename safely` |
| **F-14** | MIME Type Spoofing on File Uploads | HIGH | `src/server/storage/attachments.ts` | `rejects wrong magic bytes` |
| **F-15** | Missing Standard Security Headers | MEDIUM | `src/server/app.ts` | Security headers test suite |
| **F-16** | Unrestricted Input Lengths (DoS) | MEDIUM | `src/server/routes/grievances.ts` | Length validation tests |
| **F-17** | Inline Attachment Content Execution | MEDIUM | `src/server/routes/attachments.ts` | `Content-Disposition: attachment` test |
| **F-18** | Student Privilege Escalation on Status | MEDIUM | `src/server/routes/grievances.ts` | `student cannot change status of any grievance` |
| **F-19** | Missing Security Audit Logging | MEDIUM | `src/server/audit.ts` | Security log assertions |
| **F-20** | Empty / Single-character Comment Spam | LOW | `src/server/routes/grievances.ts` | `rejects comment that is too short` |
| **F-21** | Undocumented CORS Environment Configuration | LOW | `.env.example` | Configuration review |
| **F-22** | Credential Leakage via Git Repositories | LOW | `.gitignore` | Secret pattern exclusions |
| **F-23** | Timing Discrepancy in Login Flow | LOW | `src/server/routes/auth.ts` | Constant-time verification structure |
| **F-24** | Foreign Key Deletion Cascade Failures | HIGH | `src/server/db/schema.ts` | Cascade deletion verification |
| **F-25** | Orphaned Physical Attachment Files | HIGH | `src/server/storage/attachments.ts` | Disk artifact cleanup verification |
| **F-26** | Stored XSS via Comment Body Rendering | CRITICAL | Svelte UI components | Safe template interpolation verification |
| **F-27** | Missing Superuser RBAC Boundary | HIGH | `src/server/routes/users.ts` | Hierarchical RBAC test suite |

---

## 7. Production Deployment Checklist

Before deploying to production, verify the following operational controls:

- [ ] **TLS / HTTPS Termination**: Ensure reverse proxy (NGINX/Caddy/Cloudflare) enforces HTTPS with valid TLS certificates and sets `Strict-Transport-Security` (HSTS).
- [ ] **NODE_ENV=production**: Verify `NODE_ENV=production` is set in the environment to activate `Secure` cookie attributes.
- [ ] **HOSTEL_ALLOWED_ORIGINS**: Set to the exact production frontend origin (e.g. `https://grievance.university.edu`).
- [ ] **Database ACLs**: Ensure `data/hostel.db` and the `uploads/` directory are owned by a dedicated, non-root system service user with minimal OS permissions (`chmod 700`).
- [ ] **Change Default Passwords**: Ensure test credentials (`admin123`, `warden123`, `student123`) are reset and replaced with strong institutional passwords.
- [ ] **Log Ingestion**: Direct `stdout` and `stderr` to a centralized, access-controlled log aggregator (Datadog, Loki, CloudWatch).
- [ ] **Database Backups**: Implement scheduled automated snapshots of `data/hostel.db` using SQLite online backup APIs (`VACUUM INTO`).
