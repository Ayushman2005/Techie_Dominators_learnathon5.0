# 📋 Submission & Evaluation Guide — HostelGrievance

**Project**: HostelGrievance — University Hostel Grievance Management System  
**Track**: Web Application Security & Hardening (Learnathon 5.0)  
**Team**: Techie Dominators  
**Version**: 2.0  
**Stack**: SvelteKit (CSR) + Hono API (Node.js/TypeScript) + better-sqlite3 + Tailwind CSS  

---

## 1. Submission Package Overview

This repository contains the complete production-grade source code, automated verification test suite, threat model, and security hardening register:

```text
HostelGrievance/
├── src/
│   ├── lib/                  # Frontend Svelte 5 components, stores & API services
│   ├── routes/               # Role-based portals (Admin, Warden, Student, Login)
│   └── server/               # Hono backend API, SQLite schema, queries & security middleware
├── data/                     # SQLite database directory (data/hostel.db)
├── uploads/                  # Secure local attachment storage directory
├── HARDENING.md              # Complete security hardening register (F-01 to F-27)
├── SECURITY.md               # Production security posture & architectural controls
├── THREAT-MODEL.md           # Formal STRIDE threat analysis & asset inventory
├── SUBMISSION.md             # Reviewer execution & verification guide (this file)
├── package.json              # Project dependencies & scripts
└── tsconfig.json             # TypeScript compiler configuration
```

---

## 2. Step-by-Step Execution Commands

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Initialize & Seed Database
Rebuilds the SQLite database (`data/hostel.db`), applies schema migrations, and seeds test accounts with bcrypt-hashed passwords:
```bash
npm run db:reset
```

### Step 3: Run Full Automated Verification Suite
Executes all **85 security, authorization, and business workflow tests**:
```bash
npm test
```

### Step 4: Run Static Typechecking
Verifies TypeScript compilation and Svelte component syntax (0 errors, 0 warnings):
```bash
npm run typecheck
```

### Step 5: Launch Local Application Server
Starts both the frontend UI (`http://localhost:5173`) and the backend API service (`http://127.0.0.1:3001`):
```bash
npm run dev:all
```

---

## 3. Test Credentials

| Role | Email Address | Password | Identifiers | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **👑 Admin** | `admin@example.test` | `admin123` | `EMP-ADM01` | Full system governance, user management, audit logs, all grievances |
| **🏢 Warden** | `warden@example.test` | `warden123` | `EMP-WAR01` | Manages assigned students, triages tickets, posts hostel notices |
| **🎓 Student** | `student@example.test` | `student123` | Roll: `24BCE1001` | Files complaints, uploads evidence, reviews resolved issues |
| **🎓 Student** | `priya@example.test` | `student123` | Roll: `24BCE1002` | Resident student in Room A-112 |
| **🎓 Student** | `rohan@example.test` | `student123` | Roll: `24BCE1003` | Resident student in Room C-008 |

---

## 4. Security Hardening Register (F-01 to F-27)

| ID | Finding | Risk | Change Implemented | Verification Test | Residual Risk |
|---|---|---|---|---|---|
| **F-01** | **IDOR on Grievance View (`GET /:id`)**: `assertCanViewGrievance()` was never called | CRITICAL | Enforced `assertCanViewGrievance(user, row, db)` on every grievance access | Test: `student cannot read another student's grievance` | None |
| **F-02** | **IDOR on Grievance Edit (`PATCH /:id`)**: Student branch lacked ownership validation | CRITICAL | Added `row.student_id !== user.id` check | Test: `student cannot PATCH another student's grievance` | None |
| **F-03** | **IDOR on Attachment Download (`GET /attachments/:id`)**: Checked auth but not ownership | CRITICAL | Loaded parent grievance and validated ownership before streaming bytes | Test: `student cannot download another student's attachment` | None |
| **F-04** | **IDOR on Comments (`/:id/comments`)**: No ownership check on reading or posting | HIGH | Added `assertCanViewGrievance()` to both comment routes | Tests: `student cannot read/post comments on another student's grievance` | None |
| **F-05** | **CORS Wildcard with Credentials**: `allow_origins=["*"]` with `credentials: true` | CRITICAL | Replaced with explicit allowlist from `HOSTEL_ALLOWED_ORIGINS` | Tests: `allows trusted origin`, `does not reflect untrusted origin` | Operator must configure production origin |
| **F-06** | **Unsalted SHA-256 Passwords**: Fast, unsalted hashes vulnerable to rainbow tables | CRITICAL | Replaced with bcrypt (10 rounds, salted, intentionally slow) | Test: `login works for student and warden accounts` | None |
| **F-07** | **Session Cookie Missing HttpOnly**: Token readable by JavaScript (XSS theft) | HIGH | Added `httpOnly: true` to `setCookie()` | Test: `session cookie has HttpOnly and SameSite attributes` | None |
| **F-08** | **Session Cookie Missing SameSite & CSRF**: Risk of forged cross-site requests | HIGH | Added `sameSite: 'Strict'` and Double-Submit `X-CSRF-Token` header verification | Test: `session cookie has HttpOnly and SameSite attributes` | None |
| **F-09** | **Session Expiration Not Enforced**: Expired tokens in SQLite remained valid | HIGH | Added expiry check in `readSessionUser()` and eager cleanup | Test: `expired session is rejected` | None |
| **F-10** | **Logout Left Server Session Active**: Only deleted browser cookie | HIGH | Logout calls `destroySession(db, token)` to delete DB record | Test: `logout destroys server-side session so token cannot be reused` | None |
| **F-11** | **Internal Errors Leaked to Clients**: `handleError` returned raw `err.message` | HIGH | Masked errors to `"An unexpected error occurred."` and logged details server-side | Test: `unexpected errors return generic message` | Server logs must be protected |
| **F-12** | **No Login Rate Limiting**: Unlimited brute-force credential stuffing | HIGH | Added sliding-window rate limiter (10 attempts / min per IP) | Test: `rate-limits login after 10 failed attempts` | In-memory store resets on restart |
| **F-13** | **Path Traversal via Stored Upload Name**: User-supplied filenames used on disk | HIGH | Server now generates random UUID filenames (`[uuid].[ext]`) | Test: `handles path-traversal-style filename safely` | None |
| **F-14** | **No Magic Byte Validation**: Executable scripts disguised with image MIME headers | HIGH | Added binary magic byte verification for JPEG, PNG, GIF, WebP, PDF | Tests: `rejects wrong magic bytes`, `rejects non-image with image MIME` | None |
| **F-15** | **Missing Standard Security Headers**: No CSP, X-Content-Type-Options, Frame-Options | MEDIUM | Added middleware applying CSP, nosniff, DENY, and Referrer-Policy headers | Tests: all security header assertion tests | HSTS should be set by reverse proxy |
| **F-16** | **Unbounded Input Lengths**: Excessively large strings could cause storage/DoS issues | MEDIUM | Enforced max length limits (Title ≤ 200, Description ≤ 5000, Comment ≤ 2000) | Tests: all input length validation tests | None |
| **F-17** | **Inline Attachment Execution**: Attachments served with `inline` disposition | MEDIUM | Changed default to `Content-Disposition: attachment` | Test: `attachment download sets Content-Disposition: attachment` | None |
| **F-18** | **Student Status Escalation**: Students could modify grievance status to 'resolved' | MEDIUM | Student PATCH branch rejects `status` modifications with `403 Forbidden` | Test: `student cannot change status of any grievance` | None |
| **F-19** | **Missing Audit Trail**: No visibility into security events or mutations | MEDIUM | Implemented structured audit logger writing to `audit_logs` table and stdout | Tests: audit log generation tests | Logs should be aggregated in prod |
| **F-20** | **Empty Comment Spam**: Whitespace or single character comments accepted | LOW | Enforced 3-character minimum length on comments | Test: `rejects comment that is too short` | None |
| **F-21** | **Undocumented Production CORS**: Missing deployment instructions | LOW | Added `HOSTEL_ALLOWED_ORIGINS` to `.env.example` with docs | Manual review | None |
| **F-22** | **Incomplete `.gitignore` Secret Filters**: Certificates & keys not excluded | LOW | Added `*.pem`, `*.key`, `*.p12`, `.env.local` to `.gitignore` | Manual review | None |
| **F-23** | **Login Timing Side-Channel**: Timing discrepancy revealed email existence | LOW | Implemented dummy verification structure in `auth.ts` | Manual review | None |
| **F-24** | **Foreign Key Constraint Failures on User Deletion**: Deleting users failed DB FK checks | HIGH | Added `ON DELETE CASCADE` to foreign keys in `schema.ts` | Test: `admin can update users and delete a grievance` | None |
| **F-25** | **Orphaned Attachment Files**: Deleting grievances left binary files on disk | HIGH | Added `deleteStoredFile()` cleanup utility invoked prior to SQL deletion | Test: `stores attachment binaries in filesystem and sets data to NULL` | None |
| **F-26** | **Stored XSS via Comment Rendering**: `{@html comment.body}` rendered raw HTML | CRITICAL | Replaced with safe Svelte interpolation `{comment.body}` | Verified in Svelte components | None |
| **F-27** | **Missing Superuser RBAC Boundary**: No administrative role isolation | HIGH | Implemented hierarchical RBAC with Admin, Warden, and Student role boundaries | Tests: `admin login succeeds`, `warden can manage students`, `RBAC tests` | None |

---

## 5. Verification Evidence Summary

- **Automated Tests**: 85 tests passing across 1 test file (`src/server/app.test.ts`).
- **Static Type Check**: `npm run typecheck` passes with **0 errors and 0 warnings**.
- **Code Coverage Areas**:
  - Full Authentication Lifecycle (Login, Session Renewal, Invalidation, Logout).
  - Anti-BOLA / IDOR Verification on Grievances, Attachments, Comments, and Reviews.
  - Hierarchical Role-Based Access Control (Admin vs. Warden vs. Student).
  - Rate Limiting and Brute-Force Throttling.
  - File Upload Validation (Magic bytes, UUID storage, Directory boundary check).
  - Audit Log Filtering, Statistics, and CSV Export Formula Sanitization.
  - Physical Attachment Disk Cleanup on Grievance/User Cascade Deletion.
