# Threat Model — HostelGrievance

**Version**: 2.0  
**Date**: 2026-08-29  
**Application**: HostelGrievance — University Hostel Grievance Management System  
**Stack**: SvelteKit (CSR) + Hono (Node.js) + better-sqlite3  

---

## 1. Assets Inventory

| Asset | Sensitivity | Protection Objective |
| :--- | :--- | :--- |
| **Student Personal Data** (Name, email, room, roll number) | HIGH | Confidentiality & Integrity; visible to owner, assigned warden & admins |
| **Student & Staff Credentials** (Password hashes) | CRITICAL | Confidentiality & Integrity; bcrypt salted hashes; never returned over API |
| **Authentication Session Tokens** | CRITICAL | Stored as SHA-256 hashes in DB; HttpOnly, SameSite=Strict cookies in transit |
| **Grievance Records & Discussion** | HIGH | Student reads/edits own only; wardens read/manage assigned students; admins full oversight |
| **Resolution Reviews & Proof Photos** | HIGH | Student owner submits rating & solution proof; wardens/admins inspect |
| **Attachment Files** (Evidence photos/PDFs) | HIGH | Authorization-gated streaming; non-executable storage; randomized UUID paths |
| **Broadcast Notices & Announcements** | MEDIUM | Integrity; Wardens broadcast to assigned hostel; Admins broadcast globally |
| **Audit Logs & Security Events** | HIGH | Integrity & Confidentiality; Admin surveillance only; formula-injection protected |
| **Hostel Architecture Records** | MEDIUM | Integrity; Admin managed |
| **Database File (`hostel.db`)** | CRITICAL | Not web-accessible; file permissions restricted to app process |
| **Application Secrets / Environment** | CRITICAL | Stored in `.env` only; excluded from version control |
| **Server Filesystem (`uploads/`)** | HIGH | File operations constrained to randomized UUIDs within upload directory |

---

## 2. Actors & Threat Profiles

| Actor | Trust Level | Description & Capabilities |
| :--- | :--- | :--- |
| **Unauthenticated Attacker** | NONE | No active session. May attempt brute-force login, CSRF, IDOR, or DoS attacks. |
| **Authenticated Student** | LOW | Valid student session. Permitted to file grievances, upload evidence, comment on own tickets, and submit resolution reviews. |
| **Authenticated Warden** | MEDIUM | Valid staff session. Permitted to triage grievances, update status, comment, manage assigned students, and broadcast notices to their hostel. |
| **Authenticated Administrator** | HIGH | System governance. Full CRUD on users, hostels, grievances, analytics, and audit surveillance. |
| **Compromised Account** | VARIABLE | Attacker possessing stolen session cookie or credentials. Blast radius constrained by RBAC and session invalidation mechanisms. |
| **Malicious File Uploader** | LOW | May attempt uploading polyglot files, scripts, or path traversal payloads disguised as images/PDFs. |

---

## 3. Trust Boundaries

```
┌─────────────────────────────────────────────────────────┐
│  Internet / Browser Client                              │
│  Trust: NONE. All incoming data is untrusted.           │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS (enforced by reverse proxy)
┌─────────────────────▼───────────────────────────────────┐
│  SvelteKit Frontend (CSR — Single Page App)             │
│  Trust: UX routing ONLY. Not a security boundary.       │
│  All business rules authoritative on backend.           │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API + SameSite=Strict Cookies + X-CSRF-Token
┌─────────────────────▼───────────────────────────────────┐
│  Hono API Gateway (Node.js)                             │
│  Trust: Enforces edge defenses:                         │
│  - Global Request Body Size Guard (10 MB max)           │
│  - CORS Allowlist Verification                          │
│  - Security Response Headers                            │
│  - Sliding Window Rate Limiting                         │
│  - Double-Submit CSRF Verification                      │
└─────────────────────┬───────────────────────────────────┘
                      │ Validated Session Cookie
┌─────────────────────▼───────────────────────────────────┐
│  Authentication & Identity Layer                        │
│  Trust: Validates SHA-256 token hash against DB.        │
│  Enforces server-side 7-day TTL and expiry checks.      │
└─────────────────────┬───────────────────────────────────┘
                      │ Authenticated User Context
┌─────────────────────▼───────────────────────────────────┐
│  Hierarchical RBAC & Object Authorization Layer         │
│  Trust: assertCanViewGrievance() & role checks.         │
│  Enforces owner verification & warden-student mapping.  │
└─────────────────────┬───────────────────────────────────┘
                      │ Parameterized SQL Queries
┌─────────────────────▼───────────────────────────────────┐
│  Database Layer (better-sqlite3 / SQLite)               │
│  Trust: Foreign key cascading constraints enabled.       │
│  Zero string-concatenated SQL queries.                  │
└─────────────────────┬───────────────────────────────────┘
                      │ Server-generated UUID File Names
┌─────────────────────▼───────────────────────────────────┐
│  Storage Layer (uploads/)                               │
│  Trust: Path traversal verification & magic byte checks.│
│  deleteStoredFile() disk cleanup on record deletion.    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Attack Surface & Endpoint Scoping

| Endpoint | Method | Auth | Role Scope | Security Controls |
| :--- | :--- | :--- | :--- | :--- |
| `/api/login` | `POST` | No | Public | Rate-limited (10/min), salted bcrypt, generic error messages |
| `/api/logout` | `POST` | Yes | Any | Server-side session record destruction + cookie purge |
| `/api/me` | `GET` | Yes | Any | Returns authenticated user profile |
| `/api/users/me` | `PUT` | Yes | Any | Self-service contact update; CSRF protected |
| `/api/users/me/change-password` | `POST` | Yes | Any | Current password verified; revokes all existing sessions |
| `/api/users` | `GET` | Yes | Warden/Admin | Scoped: Admin sees all; Warden sees assigned students only |
| `/api/users` | `POST` | Yes | Warden/Admin | Admin creates any; Warden creates students in own hostel only |
| `/api/users/:id` | `PATCH` | Yes | Warden/Admin | Role change restricted to Admin; Warden updates assigned only |
| `/api/users/:id` | `DELETE` | Yes | Warden/Admin | Self-delete blocked; Warden deletes assigned students only |
| `/api/grievances` | `GET` | Yes | Any | Scoped: Student (own); Warden (assigned students); Admin (all) |
| `/api/grievances` | `POST` | Yes | Student | Rate-limited; Magic bytes verified; UUID storage |
| `/api/grievances/:id` | `GET` | Yes | Any | Anti-IDOR: `assertCanViewGrievance` enforced |
| `/api/grievances/:id` | `PATCH` | Yes | Any | Student: edits content of open; Warden: updates status |
| `/api/grievances/:id` | `DELETE` | Yes | Admin | Admin-only; Cascades physical attachment deletion from disk |
| `/api/grievances/:id/comments` | `GET/POST` | Yes | Any | Anti-IDOR: `assertCanViewGrievance`; Rate-limited |
| `/api/grievances/:id/attachments` | `POST` | Yes | Student | Student owner only; 5 attachment max; 5MB cap |
| `/api/grievances/:id/review` | `POST` | Yes | Student | Owner only; Rating 1–5; Requires solution photo |
| `/api/attachments/:id` | `GET` | Yes | Any | Ownership verified via parent grievance; Attachment disposition |
| `/api/notices` | `GET` | Yes | Any | Scoped by student/warden hostel + global notices |
| `/api/notices` | `POST` | Yes | Warden/Admin | Warden targets own hostel; Admin can target any hostel |
| `/api/hostels` | `GET/POST/DEL` | Yes | Admin (write) | Admin manages hostel buildings and blocks |
| `/api/audit-logs` | `GET/EXPORT` | Yes | Admin | Formula injection sanitization on CSV export |

---

## 5. STRIDE Threat Analysis & Threat Scenarios

### T1: IDOR / BOLA — Student Accesses Another Student's Grievance (Information Disclosure)
- **Threat**: Student attempts to view `GET /api/grievances/GRV-9999` filed by another student.
- **Control**: `assertCanViewGrievance(user, row, db)` validates `row.student_id === user.id`.
- **Status**: ✅ **MITIGATED**

### T2: IDOR — Unauthorized Attachment Download (Information Disclosure)
- **Threat**: Attacker accesses `GET /api/attachments/att-xxxx` to download private evidence.
- **Control**: Endpoint queries parent grievance and calls `assertCanViewGrievance()` before reading file bytes.
- **Status**: ✅ **MITIGATED**

### T3: Privilege Escalation — Student Modifies Ticket Status (Tampering)
- **Threat**: Student sends `PATCH /api/grievances/:id` with `{"status": "resolved"}`.
- **Control**: Role-based switch in PATCH handler rejects `status` modifications from students with `403 Forbidden`.
- **Status**: ✅ **MITIGATED**

### T4: Session Fixation & Token Theft (Spoofing)
- **Threat**: Attacker intercepts or guesses session tokens.
- **Control**: 256-bit entropy random tokens; stored as SHA-256 hashes in DB; `HttpOnly`, `SameSite=Strict`, `Secure` cookie attributes.
- **Status**: ✅ **MITIGATED**

### T5: Session Persistence After Logout / Password Reset (Elevation of Privilege)
- **Threat**: Stolen token reused after the user logs out or updates their password.
- **Control**: `/api/logout` and password changes execute `deleteSessionsForUser(db, userId)` to destroy session tokens in SQLite.
- **Status**: ✅ **MITIGATED**

### T6: Credential Brute-Force & Stuffing (Spoofing)
- **Threat**: Automated password guessing against login endpoint.
- **Control**: Sliding-window rate limiter (10 attempts / min per IP) + computational cost of bcrypt (10 rounds).
- **Status**: ✅ **MITIGATED**

### T7: Weak Password Hashing & Rainbow Table Attacks (Information Disclosure)
- **Threat**: Database theft followed by offline hash cracking.
- **Control**: Salted bcrypt (10 rounds); unsalted legacy SHA-256 hashes completely eradicated.
- **Status**: ✅ **MITIGATED**

### T8: Cross-Site Request Forgery — CSRF (Tampering)
- **Threat**: Malicious third-party website triggers state-changing actions on behalf of authenticated user.
- **Control**: `SameSite=Strict` cookie policy + Double-Submit `X-CSRF-Token` header verification on all mutating requests.
- **Status**: ✅ **MITIGATED**

### T9: Cross-Origin Resource Sharing Abuse (Information Disclosure)
- **Threat**: Malicious domain makes credentialed fetch requests to read private student data.
- **Control**: Explicit origin allowlist via `HOSTEL_ALLOWED_ORIGINS`; wildcards with credentials disallowed.
- **Status**: ✅ **MITIGATED**

### T10: Malicious Executable Upload (Tampering / Remote Code Execution)
- **Threat**: Attacker uploads `.php`, `.exe`, or `.js` script disguised as an image.
- **Control**: MIME allowlist + byte-level magic signature verification for JPEG, PNG, GIF, WebP, and PDF; forced `attachment` disposition.
- **Status**: ✅ **MITIGATED**

### T11: Path Traversal via Filenames (Tampering / Information Disclosure)
- **Threat**: Filenames like `../../../../etc/passwd` used to overwrite or read system files.
- **Control**: Physical disk files named exclusively with server-generated UUIDs; canonical path resolution checks.
- **Status**: ✅ **MITIGATED**

### T12: SQL Injection (Tampering / Information Disclosure)
- **Threat**: SQL metacharacters injected into search, filters, or form bodies.
- **Control**: Prepared statements with parameterized arguments across all `better-sqlite3` database queries.
- **Status**: ✅ **MITIGATED**

### T13: Internal Stack Trace & Schema Leakage (Information Disclosure)
- **Threat**: Provoking server errors to reveal internal filesystem paths and database schema details.
- **Control**: Global `handleError` sanitizes unexpected errors, returning generic `"An unexpected error occurred."` while logging details to server logs.
- **Status**: ✅ **MITIGATED**

### T14: Formula Injection / CSV Injection in Audit Export (Tampering / Client-Side Execution)
- **Threat**: Attacker registers with name `=cmd|'/c calc'!A1` and admin exports audit logs to CSV.
- **Control**: `sanitizeCsvCell()` prefixes all formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with a single quote (`'`).
- **Status**: ✅ **MITIGATED**

### T15: Stored Cross-Site Scripting (XSS) in Discussion & Reviews (Tampering)
- **Threat**: Submitting `<script>` or event handlers in comments, grievance descriptions, or review feedback.
- **Control**: Frontend uses Svelte automatic HTML escaping; raw `{@html}` rendering removed from all user content.
- **Status**: ✅ **MITIGATED**

### T16: Storage Exhaustion via Orphaned Files (Denial of Service)
- **Threat**: Deleting grievances or users leaves heavy attachments on disk until server storage fills up.
- **Control**: `deleteGrievance` and `deleteUser` call `deleteStoredFile()` to unlink physical files before deleting database rows.
- **Status**: ✅ **MITIGATED**

### T17: Cross-Warden Isolation & Unauthorized Resident Deletion (Tampering)
- **Threat**: Warden A attempts to modify or delete students assigned to Warden B.
- **Control**: Warden authorization in `/api/users/:id` checks `targetUser.warden_id === user.id`.
- **Status**: ✅ **MITIGATED**

### T18: Resolution Review Forgery (Tampering)
- **Threat**: Attacker or staff submits fake 5-star ratings on unresolved grievances.
- **Control**: `/api/grievances/:id/review` validates that grievance is `resolved`, caller is the student owner, review does not already exist, and a valid photo proof is attached.
- **Status**: ✅ **MITIGATED**

---

## 6. Blast-Radius Analysis

| Compromised Boundary | Attacker Access | Confined / Protected Boundary |
| :--- | :--- | :--- |
| **Student Session Token** | View/comment/review own grievances only | Cannot view other students' data, cannot view warden/admin tools, cannot access database |
| **Warden Session Token** | Manage assigned students, triage assigned grievances, post hostel notices | Cannot access other wardens' students, cannot modify admin accounts, cannot delete DB |
| **Upload Directory Access** | Read stored UUID image/PDF files | Cannot execute code (no interpreter), cannot read database or `.env` file |
| **Database File Exposure** | Bcrypt password hashes (slow to brute-force), grievance records, SHA-256 token hashes | Host OS credentials protected; active sessions cannot be reversed from SHA-256 hashes |

---

## 7. Residual Risks & Future Hardening Recommendations

1. **Multi-Factor Authentication (MFA)**:
   - *Risk*: Password compromise allows unauthorized access.
   - *Recommendation*: Introduce TOTP (Authenticator App) MFA for Administrator and Warden accounts.
2. **Distributed Rate Limiting (Redis)**:
   - *Risk*: In-memory rate limiting store resets upon process restart.
   - *Recommendation*: Connect to a Redis cluster for multi-instance high-availability deployments.
3. **ClamAV / Antivirus Scanning**:
   - *Risk*: Advanced steganography or malicious PDF structures.
   - *Recommendation*: Integrate asynchronous antivirus streaming (e.g. ClamAV daemon) for uploaded attachments.
4. **Sandboxed Static Asset Domain**:
   - *Risk*: Inline PDF execution on the same origin.
   - *Recommendation*: Host file downloads on an isolated domain (e.g. `https://attachments-cdn.university.edu`).
