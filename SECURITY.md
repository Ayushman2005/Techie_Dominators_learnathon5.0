# Security Posture — HostelGrievance

**Version**: 1.0  
**Date**: 2026-08-28  
**Stack**: SvelteKit (CSR) + Hono (Node.js/TypeScript) + better-sqlite3

---

## 1. Security Posture Summary

HostelGrievance has undergone a full security hardening pass before public deployment. 23 findings were identified; all critical and high findings have been remediated. The application now enforces server-side authorization on every API endpoint, uses modern password hashing, protects session cookies, validates file uploads at the byte level, and provides structured security event logging.

---

## 2. Architecture Overview

```
Browser (SvelteKit SPA, CSR only)
        │
        │  HTTPS (enforced by reverse proxy)
        ▼
Hono API (Node.js/TypeScript)
  ├── CORS allowlist middleware
  ├── Security headers middleware
  ├── Rate limiting middleware (login)
  ├── Routes:
  │   ├── /api/login (rate-limited)
  │   ├── /api/logout (server-side session destroy)
  │   ├── /api/me
  │   ├── /api/grievances (scoped by role)
  │   ├── /api/grievances/:id (ownership enforced)
  │   ├── /api/grievances/:id/comments (ownership enforced)
  │   ├── /api/grievances/:id/attachments (owner only)
  │   └── /api/attachments/:id (ownership via grievance)
  └── Error handler (no internal detail leakage)
        │
        ▼
SQLite (better-sqlite3)
  └── Parameterized queries only
        │
        ▼
Filesystem (uploads directory)
  └── Server-generated random filenames only
```

---

## 3. Major Security Improvements

### 3.1 IDOR Fixes (CRITICAL × 4)
The most impactful finding was that four API endpoints had Insecure Direct Object Reference (IDOR) / Broken Object Level Authorization (BOLA) vulnerabilities:

- `GET /api/grievances/:id` — the `assertCanViewGrievance()` helper existed but was **never called**
- `PATCH /api/grievances/:id` — student branch had no ownership check
- `GET /api/attachments/:id` — only checked authentication, not grievance ownership  
- `GET /api/grievances/:id/comments` and `POST /:id/comments` — no ownership check

All four are now fixed. The `assertCanViewGrievance()` function is now called consistently across all grievance and attachment access paths.

### 3.2 Password Hashing
Replaced SHA-256 (unsalted, fast) with **bcrypt** (10 rounds, salted, intentionally slow). bcrypt is resistant to rainbow tables and slows brute-force to ~100ms per attempt.

### 3.3 Session Security
- `HttpOnly` cookie — JavaScript cannot read the session token
- `SameSite=Strict` — cross-site request forgery prevention
- `Secure` flag — enabled in production (NODE_ENV=production)
- Server-side expiry validation — `expires_at` checked on every request
- Session destroyed on logout — token deleted from DB, cannot be reused

### 3.4 CORS Hardening
Replaced `allow_origins=["*"]` with `credentials: true` (the most dangerous CORS configuration) with an explicit allowlist. Configure via `HOSTEL_ALLOWED_ORIGINS` environment variable.

### 3.5 File Upload Security
- MIME type allowlist: JPEG, PNG, GIF, WebP only
- **Magic byte validation**: actual file bytes validated against known signatures — detects MIME spoofing
- **Random stored filenames**: stored name is always a server-generated UUID; user-supplied filename is never used as a filesystem path
- Path traversal protection: double validation (pattern check + canonical path resolution)
- `Content-Disposition: attachment` — forces download, prevents inline execution

### 3.6 Error Handling
Unexpected errors (DB errors, stack traces, filesystem paths) are now logged server-side only. Clients receive only `"An unexpected error occurred."`.

---

## 4. Authentication Model

| Property | Value |
|---|---|
| Mechanism | Server-side sessions with cookie |
| Cookie name | `hg_session` |
| Cookie flags | HttpOnly, SameSite=Strict, Secure (production), MaxAge=7 days |
| Token entropy | 32 bytes = 256-bit (cryptographically random) |
| Password algorithm | bcrypt, 10 rounds |
| Login rate limit | 10 attempts / 15 minutes / IP |
| Session expiry | 7 days (server-side validated) |
| Logout | Server-side session destroyed + cookie cleared |
| Enumeration protection | Same error message for wrong email and wrong password |

---

## 5. Authorization Model

| Role | Grievances | Comments | Attachments | Status |
|---|---|---|---|---|
| Student | Own only (list + read + edit content) | Own grievances only | Own grievances only | Cannot change |
| Warden | All (list + read) | Any grievance | Any grievance (read) | Can change any |

Authorization is enforced server-side on every request via `assertCanViewGrievance()`. The frontend route guards are UX only.

**Key principle**: `student_id` in grievance ownership is always taken from the authenticated session — never from the client request body.

---

## 6. File Security

- **Allowlist**: image/jpeg, image/png, image/gif, image/webp
- **Size limit**: 2 MB maximum
- **Magic bytes**: actual file content validated (not just MIME header)
- **Storage**: `uploads/` directory, random UUID filenames
- **Download**: authorization-gated (`GET /api/attachments/:id` requires session + grievance ownership)
- **Serving**: `Content-Disposition: attachment` (force download) + `X-Content-Type-Options: nosniff`
- **Path traversal**: user-supplied filenames never used as filesystem paths; canonical path resolution on read

**Residual risk**: No antivirus scanning. Only image types accepted; magic byte validation significantly reduces risk of malicious content. Re-encoding images would provide additional protection.

---

## 7. Input Validation

| Field | Minimum | Maximum | Type |
|---|---|---|---|
| Grievance title | 5 chars | 200 chars | String |
| Grievance description | 20 chars | 5000 chars | String |
| Grievance category | — | — | Enum (7 values) |
| Comment body | 3 chars | 2000 chars | String |
| Email | 1 char | 254 chars | String (login) |
| Password | 1 char | 1024 chars | String (login) |
| Attachment | — | 2 MB | JPEG/PNG/GIF/WebP |

All validation is server-side. Frontend validation is UX only.

---

## 8. Security Headers

All `/api/*` responses include:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing attacks |
| `X-Frame-Options` | `DENY` | Legacy frame embedding protection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Prevents URL leakage in Referer |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` | Disallow all resource loading from API responses |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable unnecessary browser features |

**Note**: `Strict-Transport-Security` (HSTS) should be set by the reverse proxy terminating TLS, not the application server.

---

## 9. Logging and Monitoring

Security events are logged as structured JSON to stdout. Log entries include:
- `timestamp`, `event`, `userId`, `role`, `resourceId`, `reason`, `email` (login only)
- Events: `login_success`, `login_failure`, `logout`, `auth_failure`, `authorization_failure`, `session_expired`, `rate_limit_exceeded`, `file_upload_success`, `file_upload_rejected`, `grievance_created`, `grievance_status_changed`, `comment_created`

**Never logged**: passwords, session tokens, full request bodies, sensitive personal data beyond what is listed above.

In production, redirect stdout to a log aggregator (e.g. CloudWatch, Datadog, Loki).

---

## 10. Runtime Security

- No Docker container currently in use (development setup)
- Application should be run as a non-root OS user in production
- The `uploads/` directory should be outside the web-served document root
- The `data/` directory (SQLite DB) should not be web-accessible

---

## 11. Assumptions

- HTTPS is enforced by a reverse proxy (nginx, caddy, etc.) in production
- The reverse proxy sets appropriate headers (HSTS, `X-Real-IP` for rate limiting)
- The database file is on a filesystem with appropriate OS-level permissions
- The `uploads/` directory is not directly web-accessible (not served as static files)
- The `.env` file is not committed to version control
- Seeded test credentials (`student123`, `warden123`) are changed before production use
- The database is rebuilt after this hardening (to re-hash passwords with bcrypt)

---

## 12. Residual Risks

| Risk | Severity | Notes |
|---|---|---|
| No antivirus scanning | MEDIUM | Images only; magic bytes mitigate most risk |
| In-memory rate limiter | LOW | Resets on restart; Redis recommended for HA |
| No MFA | MEDIUM | Recommended for warden accounts |
| localStorage user cache | LOW | Role/ID visible in browser; not a security boundary |
| No account lockout (only rate limit) | LOW | Rate limiting per IP is primary control |
| SQLite concurrency under high load | LOW | WAL mode; acceptable for university scale |

---

## 13. Deployment Checklist

Before going live, verify:

- [ ] **HTTPS enabled** — reverse proxy terminating TLS with valid certificate
- [ ] **NODE_ENV=production** — enables `Secure` cookie flag
- [ ] **HOSTEL_ALLOWED_ORIGINS** set to production frontend URL
- [ ] **Debug mode disabled** — no development middleware active
- [ ] **Database not publicly exposed** — `data/hostel.db` not web-accessible
- [ ] **Upload directory not executable** — `uploads/` should not be served as static files
- [ ] **Seeded passwords changed** — `student123` and `warden123` not used in production
- [ ] **Database reset** — run `npm run db:reset` to regenerate with bcrypt-hashed passwords
- [ ] **Rate limits configured** — review limits for actual expected user volume
- [ ] **Log collection configured** — stdout redirected to persistent log store
- [ ] **Secrets not in git** — verify `.env` in `.gitignore` and not committed
- [ ] **Student workflow tested** — end-to-end login → grievance → attachment → comment → logout
- [ ] **Warden workflow tested** — login → view → comment → status update → logout
- [ ] **All security tests passing** — `npm test` exits 0
- [ ] **Dependency audit reviewed** — `npm audit`; address high/critical findings
- [ ] **Process runs as non-root** — verify OS user has minimal privileges
- [ ] **Backups configured** — SQLite DB backed up regularly
- [ ] **Session TTL reviewed** — 7-day default appropriate for context
