# HostelGrievance - Security, Threat Model, Hardening & Testing Guide

**Version**: 1.0
**Date**: 2026-08-29
**Stack**: SvelteKit (CSR) + Hono (Node.js/TypeScript) + better-sqlite3

This document serves as a comprehensive guide to the security posture, threat model, applied hardening measures, and testing methodology for the HostelGrievance application.

---

## 1. Security Overview

HostelGrievance enforces server-side authorization on every API endpoint, uses modern password hashing (bcrypt), protects session cookies, validates file uploads at the byte level, and provides structured security event logging. 

### Architecture & Trust Boundaries
- **Frontend (Browser)**: SvelteKit SPA (CSR). Not a security boundary; UX controls only.
- **Backend (Hono API)**: Entry point for all security decisions, validating inputs, enforcing CORS, handling rate limiting, and setting security headers.
- **Database (SQLite)**: Receives parameterized queries only, preventing SQL injection.
- **Filesystem**: Stores uploaded files using server-generated UUIDs, preventing path traversal.

### Authentication & Authorization
- **Sessions**: Uses `HttpOnly`, `SameSite=Strict` cookies (`hg_session`) with server-side expiry validation.
- **Role-Based Access Control (RBAC)**: 
  - **Students**: Can list/read/edit their own grievances and comments, and upload attachments.
  - **Wardens**: Can read all grievances/attachments and change grievance statuses.
  - **Admins**: Superuser governance and system administration.

---

## 2. Threat Model

Our threat modeling approach assumes that all client input is untrusted and must be verified server-side.

### Key Threat Scenarios & Mitigations
- **Insecure Direct Object Reference (IDOR)**: Mitigated by `assertCanViewGrievance(user, row)` checking ownership on every access path.
- **Session Hijacking & XSS**: Mitigated by `HttpOnly` flags, preventing JavaScript access to session tokens, alongside robust CSP headers and Svelte's auto-escaping.
- **Authentication Bypass & Brute Force**: Prevented via sliding-window rate limiting (10 attempts / 15 mins per IP) and bcrypt password hashing (10 rounds, salted).
- **Malicious File Uploads & Path Traversal**: Files are restricted by MIME type and magic byte signatures (JPEG, PNG, GIF, WebP). Files are stored using randomly generated UUIDs, and served with `Content-Disposition: attachment`.
- **Cross-Site Request Forgery (CSRF)**: Prevented via `SameSite=Strict` session cookies and explicit CORS allowlists.

---

## 3. Hardening Measures

A comprehensive security hardening pass was performed prior to deployment. Key fixes include:

- **IDOR Remediation (CRITICAL)**: Implemented strict ownership checks across `GET/PATCH /api/grievances/:id`, `GET /api/attachments/:id`, and comment routes.
- **CORS Configuration (CRITICAL)**: Replaced dangerous wildcard `*` with explicit origins configured via `HOSTEL_ALLOWED_ORIGINS`.
- **Password Hashing Upgrade (CRITICAL)**: Upgraded unsalted SHA-256 to adaptive bcrypt.
- **Session Enhancements (HIGH)**: Enforced `HttpOnly` and `SameSite=Strict` on cookies, implemented server-side session destruction on logout, and fixed missing expiry validations.
- **Error & Log Security (HIGH)**: Raw error messages were removed from client responses. Structured JSON logging was added for security events (logins, uploads, rate limits) without leaking sensitive data.
- **Database Integrity (HIGH)**: Added `ON DELETE CASCADE` to foreign keys to safely clean up dependent records and orphaned attachments when a user or grievance is deleted.

---

## 4. Test Credentials & Methods

To facilitate local development, security testing, and automated validations, the system includes seeded test data and testing scripts.

### 4.1. Automated Testing Methods
- **Run Unit & Integration Tests**: 
  ```bash
  npm run test
  ```
  Runs all Vitest suites, including authorization boundary checks, IDOR protections, and input validation tests.
- **Run Tests in Watch Mode**:
  ```bash
  npm run test:watch
  ```
- **Type Checking**:
  ```bash
  npm run typecheck
  ```

### 4.2. Database Reset & Seeding
To restore the database (`data/hostel.db`) and the `uploads/` directory to a pristine seeded lab state, run:
```bash
npm run db:reset
```
*Note: This command drops all tables, recreates the schema, and populates it with the default mock data and hashed passwords.*

### 4.3. Test Credentials

After running `npm run db:reset`, the following accounts are available for manual UI testing or API scripting. 

> [!WARNING]
> These credentials must be changed or removed in production environments.

#### Administrator Accounts
- **Email**: `admin@example.test`
- **Password**: `admin123`
- **Role**: `admin`

#### Warden Accounts
- **Email**: `warden@example.test` (Mr. K. Sahu, Boys Hostel A)
- **Email**: `warden2@example.test` (Mr. R. K. Mishra, Girls Hostel B)
- **Password**: `warden123`
- **Role**: `warden`

#### Student Accounts
- **Email**: `student@example.test` (Aarav Mehta, Room B-204)
- **Email**: `priya@example.test` (Priya Nair, Room A-112)
- **Email**: `rohan@example.test` (Rohan Das, Room C-008)
- **Password**: `student123`
- **Role**: `student`
