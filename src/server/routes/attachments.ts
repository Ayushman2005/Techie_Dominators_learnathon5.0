import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { requireUser } from '../auth/session.ts';
import { assertCanViewGrievance, findAttachmentRow, findGrievanceRow } from '../db/queries.ts';
import { readStoredFile } from '../storage/attachments.ts';
import { HttpError } from '../http/errors.ts';
import { securityLog } from '../logger.ts';

export const attachmentRoutes = new Hono<AppEnv>();

attachmentRoutes.get('/:id', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);

	const attachmentRow = findAttachmentRow(db, c.req.param('id'));
	if (!attachmentRow) {
		throw new HttpError(404, 'not_found', 'Attachment was not found.');
	}

	const grievanceRow = findGrievanceRow(db, attachmentRow.grievance_id);
	if (!grievanceRow) {
		throw new HttpError(404, 'not_found', 'Attachment was not found.');
	}

	assertCanViewGrievance(db, user, grievanceRow);

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

	const safeFilename = attachmentRow.original_filename.replaceAll('"', '').replaceAll('\n', '').replaceAll('\r', '');
	c.header('Content-Type', attachmentRow.mime_type);
	c.header('Content-Length', String(bytes.length));
	c.header('Content-Disposition', `attachment; filename="${safeFilename}"`);
	c.header('X-Content-Type-Options', 'nosniff');

	return c.body(new Uint8Array(bytes));
});
