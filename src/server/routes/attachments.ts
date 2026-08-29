import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { requireUser } from '../auth/session.ts';
import { assertCanViewGrievance, findAttachmentRow, findGrievanceRow } from '../db/queries.ts';
import { readStoredFile } from '../storage/attachments.ts';
import { HttpError } from '../http/errors.ts';
import { securityLog } from '../logger.ts';

export const attachmentRoutes = new Hono<AppEnv>();

/**
 * GET /api/attachments/:id
 *
 * Serve an attachment file to an authenticated, authorized user.
 *
 * CRITICAL FIX: Previously this endpoint only checked authentication.
 * Any authenticated user (even a student not party to the grievance) could
 * download another student's attachment simply by knowing or guessing the
 * attachment ID — a classic IDOR/BOLA vulnerability.
 *
 * The fix performs a full authorization chain:
 * 1. Authenticate: valid session required
 * 2. Find attachment: must exist
 * 3. Find parent grievance: must exist
 * 4. Authorize via grievance: assertCanViewGrievance enforces
 *    - Wardens: can access any attachment
 *    - Students: can only access attachments on their own grievances
 *
 * Content-Disposition: attachment forces download instead of inline rendering,
 * reducing risk of MIME-type confusion attacks in the browser.
 *
 * X-Content-Type-Options: nosniff (set globally) prevents MIME sniffing.
 */
attachmentRoutes.get('/:id', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);

	const attachmentRow = findAttachmentRow(db, c.req.param('id'));
	if (!attachmentRow) {
		// Return 404 (not 403) to avoid leaking existence of attachment IDs
		throw new HttpError(404, 'not_found', 'Attachment was not found.');
	}

	// Load the parent grievance to perform ownership authorization
	const grievanceRow = findGrievanceRow(db, attachmentRow.grievance_id);
	if (!grievanceRow) {
		throw new HttpError(404, 'not_found', 'Attachment was not found.');
	}

	// CRITICAL: authorize against the grievance owner — students only see their own;
	// wardens see only their assigned students' grievances
	assertCanViewGrievance(user, grievanceRow, db);

	let bytes: Buffer | Uint8Array;
	try {
		bytes = readStoredFile(c.get('uploadsDir'), attachmentRow.stored_filename);
	} catch {
		if (attachmentRow.data) {
			bytes = attachmentRow.data;
		} else {
			throw new HttpError(404, 'not_found', 'Attachment file was not found.');
		}
	}

	// Content-Disposition: 'inline' allows previewing images/PDFs in the browser.
	// 'attachment' forces download. We default to attachment for safety but allow inline via query.
	// We use RFC 5987 filename*=UTF-8'' encoding to safely handle any characters in the filename.
	const isInline = c.req.query('inline') === 'true';
	const dispositionType = isInline ? 'inline' : 'attachment';
	const safeFilename = encodeURIComponent(attachmentRow.original_filename);

	c.header('Content-Type', attachmentRow.mime_type);
	c.header('Content-Length', String(bytes.length));
	c.header('Content-Disposition', `${dispositionType}; filename*=UTF-8''${safeFilename}`);
	// Prevent the browser from re-interpreting the content type
	c.header('X-Content-Type-Options', 'nosniff');

	return c.body(new Uint8Array(bytes));
});
