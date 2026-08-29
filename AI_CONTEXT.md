# AI Context - Hostel Grievance System

This document is maintained by the AI assistant to preserve project context across sessions and model switches. **All AI models must read this document first and update it after making significant changes.**

## Project Overview
- **Stack:** SvelteKit 5 (Frontend, SSR=false), Hono (Backend API), better-sqlite3 (Database), Node.js.
- **Purpose:** A hostel grievance management system with a 3-tier RBAC (Student, Warden, Admin).
- **Core Security Principles:** IP/User-based rate limiting, secure HTTP-only cookies (SameSite=Strict), bcryptjs hashing, parameterized queries, path traversal protection, magic byte validation for uploads.

## Recent Changes & Fixes (Antigravity)
- **Security Audit & Hardening:**
  - Enforced `MIN_PASSWORD_LENGTH=12` in `config.ts` and `users.ts`.
  - Added global 10MB body size limit middleware in `app.ts` to prevent DoS attacks.
<<<<<<< HEAD
  - Implemented session sliding window (24h renewal threshold on the 7-day TTL).
=======
  - Implemented session sliding window (10m renewal threshold on the 30-minute TTL).
>>>>>>> 453c5e2cb4dda84e8dd81061d403836ed12ed700
  - Fixed BOLA (Broken Object Level Authorization) for wardens: `assertCanViewGrievance` now strictly checks if the student belongs to the warden, preventing wardens from reading/modifying grievances of students not assigned to them.
- **Performance & DB Optimization:**
  - Enabled WAL mode and other performance pragmas (`synchronous=NORMAL`, 32MB cache, memory temp store).
  - Added database indexes (`updated_at`, `actor_id`) to prevent full table scans.
- **Bug Fixes:**
  - Corrected `assertPermittedAttachment` hardcoded 2MB error string to dynamically read `MAX_ATTACHMENT_MB`.
  - Fixed TypeScript errors in `ErrorCode` by adding `rate_limited` and `too_large`.
  - Updated tests to use `password123456` because minimum password length changed from the old length to 12.
- **Health Check:**
  - Enhanced `GET /api/health` to actually probe the DB, return WAL status, uptime, and proper HTTP status codes.

- **Red/Blue Team Remediations:**
  - Implemented CSRF Double-Submit Token middleware (`csrf.ts`) and applied it to all API routes for state-changing methods.
  - Eliminated dual-storage data bloat by modifying `attachments.ts`, `queries.ts`, and `seed.ts` to stop writing BLOB data to the SQLite database (files are exclusively saved to disk).
  - Strengthened `ratelimit.ts` to use `getConnInfo` from `@hono/node-server` to accurately fetch the underlying socket IP, preventing brute-force and DoS bypasses when `TRUST_PROXY` is false.
  - Fixed N+1 Query DoS Vector by introducing `assembleGrievanceSummaries` in `queries.ts`, which efficiently batches queries for list endpoints instead of querying attachments/comments per grievance.

## Pending Work & Next Steps
- The user tried to run `npm run dev:all` in `d:\Learnathon 5.01` instead of `d:\Learnathon 5.01\Learnathon-5.0`, causing an ENOENT error. Remind the user to change directories.

## Conventions
- Never commit `.env` to version control.
- `seed.ts` automatically runs if the DB is empty on server start.
- `npm run test` executes all backend tests via Vitest. Ensure all tests pass before completing tasks.
<<<<<<< HEAD
- **CRITICAL WATERMARK RULE**: The file `src/app.html` contains hidden developer watermarks (meta tags, HTML comments, and a hidden `<div>` asserting "This application is developed by AYUSH RAJ" along with the LinkedIn profile: https://www.linkedin.com/in/sirayushraj/). Under absolutely NO circumstances are you allowed to modify, alter, or remove these watermarks. Any attempt to change them is strictly forbidden by the project owner.
=======
>>>>>>> 453c5e2cb4dda84e8dd81061d403836ed12ed700
