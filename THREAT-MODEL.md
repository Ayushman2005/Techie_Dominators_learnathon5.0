# Threat Model — HostelGrievance

**Version**: 1.0  
**Date**: 2026-08-28  
**Application**: HostelGrievance — University hostel grievance management system  
**Stack**: SvelteKit (CSR) + Hono (Node.js) + better-sqlite3

---

## 1. Assets

| Asset | Sensitivity | Protection Objective |
|---|---|---|
| Student personal information (name, email, room number) | HIGH | Confidentiality; student can only see their own |
| Student credentials (password hashes) | CRITICAL | Never exposed; bcrypt hashed |
| Authentication session tokens | CRITICAL | HttpOnly, not in logs, server-side expiry |
| Grievance records | HIGH | Student reads own only; warden reads all |
| Grievance comments | HIGH | Same access as parent grievance |
| Attachment files (images) | HIGH | Authorization-gated download; not publicly addressable |
| Warden account information | HIGH | Confidentiality |
| Database file (`hostel.db`) | CRITICAL | Not web-accessible; filesystem ACL |
| Application secrets / env vars | CRITICAL | In `.env` only; excluded from git |
| Server filesystem | HIGH | File writes restricted to uploads directory |
| Structured security logs | MEDIUM | Must not contain passwords or tokens |
| API endpoints | MEDIUM | Authenticated and authorized per endpoint |

---

## 2. Actors

| Actor | Trust Level | Description |
|---|---|---|
| Unauthenticated attacker | NONE | No valid session; must be blocked from all protected resources |
| Authenticated student | LOW | Valid session; can only access their own grievances/attachments |
| Authenticated warden | MEDIUM | Valid session; broader read access, status-change capability |
| Compromised student account | LOW | Behaves as a student; blast radius limited to that student's data |
| Compromised warden account | MEDIUM-HIGH | Can read/update all grievances; cannot access DB or filesystem |
| Malicious file uploader | LOW | May upload crafted files; constrained by allowlist + magic bytes |
| Attacker with captured session token | VARIABLE | Limited to the captured account's permissions |
| Attacker exploiting application vulnerabilities | HIGH | Assumed capability; defense-in-depth designed against this |

---

## 3. Trust Boundaries

```
┌─────────────────────────────────────────────────────────┐
│  Internet / Browser                                      │
│  Trust: NONE. All input is untrusted.                    │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS (must be enforced by reverse proxy)
┌─────────────────────▼───────────────────────────────────┐
│  SvelteKit Frontend (CSR — runs in browser)              │
│  Trust: UX controls ONLY. Not a security boundary.       │
│  Route guards improve UX but backend is authoritative.   │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/REST API (same-origin in production)
┌─────────────────────▼───────────────────────────────────┐
│  Hono API (Node.js)                                      │
│  Trust: Validates everything. Entry point of all         │
│  security decisions.                                     │
│  - Input validation (schemas, length limits, types)      │
│  - CORS allowlist enforcement                            │
│  - Security headers                                      │
│  - Rate limiting                                         │
└─────────────────────┬───────────────────────────────────┘
                      │ Session cookie (HttpOnly, SameSite=Strict)
┌─────────────────────▼───────────────────────────────────┐
│  Authentication Layer                                    │
│  Trust: Cookie token validated against DB. Expiry        │
│  checked server-side. Never trust client-provided        │
│  user_id, role, or permission fields.                    │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Authorization Layer                                     │
│  Trust: Role and resource ownership enforced per         │
│  request. assertCanViewGrievance() called on every       │
│  access to a grievance or its sub-resources.             │
└─────────────────────┬───────────────────────────────────┘
                      │ Parameterized SQLite queries only
┌─────────────────────▼───────────────────────────────────┐
│  Database (better-sqlite3 / SQLite)                      │
│  Trust: Receives only validated, parameterized inputs.   │
│  Foreign key constraints enforced. Schema validated.     │
└─────────────────────┬───────────────────────────────────┘
                      │ Random-named files, canonical path check
┌─────────────────────▼───────────────────────────────────┐
│  Filesystem / Upload Storage                             │
│  Trust: Stored filenames are always server-generated     │
│  UUIDs. Read paths validated against upload directory.   │
│  No user-supplied paths reach the filesystem.            │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Node.js Process / Host OS                               │
│  Trust: Process has only the permissions it needs.       │
│  Should run as non-root in production.                   │
└─────────────────────────────────────────────────────────┘
```

### What each boundary trusts and does NOT trust

| Boundary | Trusts | Does NOT Trust |
|---|---|---|
| Hono API | Valid session cookie token | Client-provided user_id, role, permissions, ownership |
| Auth Layer | DB session record with valid expiry | Cookie value itself without DB validation |
| Authz Layer | Authenticated user's DB role | That the requested resource belongs to the user |
| Database | Parameterized query parameters | String-interpolated user input |
| Filesystem | Server-generated stored filenames | Client-supplied filenames as paths |

---

## 4. Attack Surface

| Surface | Protocol | Auth Required | Notes |
|---|---|---|---|
| `POST /api/login` | HTTP | No | Rate-limited 10/15min per IP |
| `POST /api/logout` | HTTP | Session | Destroys server session |
| `GET /api/me` | HTTP | Session | Returns public user profile |
| `GET /api/grievances` | HTTP | Session | Scoped by role |
| `POST /api/grievances` | HTTP + multipart | Session (student) | File upload: allowlist + magic bytes |
| `GET /api/grievances/:id` | HTTP | Session | Ownership enforced |
| `PATCH /api/grievances/:id` | HTTP | Session | Role-scoped fields |
| `GET /api/grievances/:id/comments` | HTTP | Session | Ownership enforced |
| `POST /api/grievances/:id/comments` | HTTP | Session | Ownership enforced, rate-limited |
| `POST /api/grievances/:id/attachments` | HTTP + multipart | Session (student owner) | File upload: allowlist + magic bytes |
| `GET /api/attachments/:id` | HTTP | Session | Ownership enforced via grievance |
| `GET /api/health` | HTTP | No | No sensitive data |

---

## 5. Threat Scenarios and Attack Paths

### T1: IDOR — Student reads another student's grievance
**Vector**: `GET /api/grievances/GRV-0003` while authenticated as a different student  
**Impact**: Data breach — student personal information, grievance details, comments  
**Control**: `assertCanViewGrievance(user, row)` called on every grievance access; enforces `row.student_id === user.id` for students  
**Status**: ✅ MITIGATED

### T2: IDOR — Student downloads another student's attachment
**Vector**: `GET /api/attachments/att-3` while authenticated as a different student  
**Impact**: File data theft  
**Control**: Attachment route loads parent grievance, calls `assertCanViewGrievance` before serving bytes  
**Status**: ✅ MITIGATED

### T3: Student changes grievance status (privilege escalation)
**Vector**: `PATCH /api/grievances/:id` with `{"status": "Resolved"}`  
**Impact**: Student can close/reopen any grievance, disrupting the warden workflow  
**Control**: Student PATCH handler rejects `status` field; only warden branch handles status changes  
**Status**: ✅ MITIGATED

### T4: Authentication bypass / session fixation
**Vector**: Forged or guessed session token in cookie  
**Impact**: Full account takeover  
**Control**: 32-byte random token (256-bit entropy); validated against DB on every request; expiry enforced server-side  
**Status**: ✅ MITIGATED

### T5: Session reuse after logout
**Vector**: Captured session cookie reused after victim logs out  
**Impact**: Account takeover despite logout  
**Control**: Logout calls `destroySession(db, token)` — deletes DB record; token is permanently unusable  
**Status**: ✅ MITIGATED

### T6: Brute-force / credential stuffing
**Vector**: Automated login attempts against known email addresses  
**Impact**: Account compromise  
**Control**: 10 attempts / 15 minutes per IP; generic error messages prevent username enumeration; bcrypt makes each attempt slow (~100ms)  
**Status**: ✅ MITIGATED

### T7: Password hashing weakness (rainbow table attack)
**Vector**: Database stolen; passwords recovered from SHA-256 hashes  
**Impact**: Mass account compromise across university  
**Control**: Passwords now hashed with bcrypt (10 rounds), with unique salt per hash; rainbow tables ineffective  
**Status**: ✅ MITIGATED (was SHA-256 unsalted)

### T8: XSS via grievance content
**Vector**: Student submits `<script>alert(1)</script>` in title/description  
**Impact**: Session hijacking (if cookie was not HttpOnly)  
**Control**: React/Svelte escapes rendered text by default; session cookie is HttpOnly (JS cannot read it); CSP disallows inline scripts from API responses  
**Status**: ✅ MITIGATED (multiple layers)

### T9: CSRF — attacker triggers state change via third-party site
**Vector**: Malicious site causes authenticated user's browser to make POST requests  
**Impact**: Grievance modification, status change  
**Control**: SameSite=Strict cookies prevent cross-site cookie transmission; CORS allowlist prevents unauthorized origins  
**Status**: ✅ MITIGATED

### T10: CORS abuse — cross-origin credentialed requests
**Vector**: `evil.com` page makes credentialed fetch to the API  
**Impact**: Data theft if CORS reflected arbitrary origins  
**Control**: CORS configured with explicit allowlist; untrusted origins not reflected; wildcard + credentials removed  
**Status**: ✅ MITIGATED (was wildcard + credentials)

### T11: Malicious file upload (executable content)
**Vector**: Upload a `.php`, `.js`, or script file disguised as an image  
**Impact**: Remote code execution if served from a web-accessible path  
**Control**: MIME type allowlist (JPEG/PNG/GIF/WebP only); magic byte validation rejects mismatched content; stored name is server-generated UUID; Content-Disposition: attachment prevents inline execution  
**Status**: ✅ MITIGATED

### T12: Path traversal via uploaded filename
**Vector**: `../../etc/passwd.png` as filename in multipart upload  
**Impact**: File overwrite, arbitrary file read  
**Control**: Stored filename always server-generated UUID — user filename never used as filesystem path; canonical path validation on read  
**Status**: ✅ MITIGATED

### T13: SQL injection
**Vector**: SQL metacharacters in grievance ID, title, email, etc.  
**Impact**: Data breach, database corruption  
**Control**: All queries use parameterized better-sqlite3 prepared statements; no string concatenation with user input  
**Status**: ✅ MITIGATED (no raw SQL with user input found)

### T14: Internal error leakage (information disclosure)
**Vector**: Triggering server errors to read stack traces, DB schema, or filesystem paths  
**Impact**: Reconnaissance; reveals attack surface  
**Control**: Unexpected errors logged server-side; clients receive only `"An unexpected error occurred."`  
**Status**: ✅ MITIGATED (was leaking raw err.message)

### T15: Session token XSS theft
**Vector**: XSS payload reads `document.cookie`  
**Impact**: Session hijacking  
**Control**: HttpOnly cookie flag prevents JS from reading the token  
**Status**: ✅ MITIGATED

### T16: Mass assignment — client-supplied sensitive fields
**Vector**: POST/PATCH with extra fields like `{"role": "warden", "student_id": "different-user"}`  
**Impact**: Privilege escalation, IDOR  
**Control**: Only explicitly extracted fields are used (title, description, category, status); server always uses `user.id` from session for ownership  
**Status**: ✅ MITIGATED

---

## 6. Residual Risks

| Risk | Severity | Notes |
|---|---|---|
| In-memory rate limiter resets on restart | LOW | Acceptable for university deployment; use Redis for multi-instance |
| No antivirus scanning of uploads | MEDIUM | Images only accepted; magic bytes validated; re-encoding would further reduce risk |
| localStorage user cache (role/id) | LOW | Not a security boundary; server-side auth is authoritative; XSS impact is session theft via HttpOnly cookie workaround only |
| SQLite not multi-user safe under high concurrency | LOW | WAL mode configured; acceptable for university scale |
| No HSTS header from application | LOW | Should be set by reverse proxy (nginx/caddy) terminating TLS |
| Warden can see all student grievances | BY DESIGN | Required for the warden review workflow |
| Session TTL is 7 days | LOW | Reasonable; consider shortening for high-security deployments |
| No MFA | MEDIUM | Out of scope for current implementation; recommended for admin accounts |

---

## 7. Blast-Radius Analysis

| Compromised Boundary | Attacker Can Access | Cannot Access |
|---|---|---|
| Student session token | That student's grievances, comments, attachments | Other students' data; warden functions; database |
| Warden session token | All grievances (read); status updates; all attachments | Database credentials; filesystem outside uploads; other warden accounts |
| Upload directory | The uploaded image files | Database; source code; credentials; other students' data directly |
| Application process | Database file (if same OS user); uploads | Host OS credentials; other processes |
| Database file | Bcrypt hashes (not crackable without brute force); grievance data | Application server; filesystem |
