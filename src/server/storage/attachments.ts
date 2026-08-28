import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from '../config.ts';
import { HttpError } from '../http/errors.ts';
import { securityLog } from '../logger.ts';

const MIME_EXTENSION: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/gif': '.gif',
	'image/webp': '.webp'
};

/**
 * Magic byte signatures for allowed image types.
 * These are checked against actual file content, not client-supplied MIME type,
 * to detect MIME-type spoofing (e.g. a .php file renamed to .jpg).
 *
 * An attacker could set Content-Type: image/png on any file — magic bytes
 * provide a second layer of validation on the actual bytes.
 */
const MAGIC_BYTES: Array<{
	mime: string;
	signature: number[];
	offset?: number;
}> = [
	// JPEG: starts with FF D8 FF
	{ mime: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
	// PNG: starts with 89 50 4E 47 0D 0A 1A 0A
	{ mime: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
	// GIF87a or GIF89a
	{ mime: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
	{ mime: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
	// WebP: RIFF....WEBP
	{ mime: 'image/webp', signature: [0x52, 0x49, 0x46, 0x46] } // "RIFF" — further validated below
];

/**
 * Validate actual file bytes against known magic byte signatures for the claimed MIME type.
 * Returns true if the file content matches the declared MIME type.
 *
 * This is defense-in-depth — it does not replace the MIME type allowlist check,
 * but catches cases where an attacker provides correct Content-Type with wrong bytes.
 */
function validateMagicBytes(bytes: Buffer, claimedMime: string): boolean {
	const matchingSignatures = MAGIC_BYTES.filter((m) => m.mime === claimedMime);
	if (matchingSignatures.length === 0) return false;

	for (const { signature, offset = 0 } of matchingSignatures) {
		if (bytes.length < offset + signature.length) continue;
		const matches = signature.every((byte, i) => bytes[offset + i] === byte);
		if (matches) {
			// Extra check for WebP: bytes at offset 8-11 should be "WEBP"
			if (claimedMime === 'image/webp') {
				if (bytes.length < 12) continue;
				const webp = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
				const webpMatches = webp.every((byte, i) => bytes[8 + i] === byte);
				if (!webpMatches) continue;
			}
			return true;
		}
	}
	return false;
}

export function ensureUploadsDir(dir: string): void {
	mkdirSync(dir, { recursive: true });
}

export function resetUploadsDir(dir: string): void {
	if (existsSync(dir)) {
		rmSync(dir, { recursive: true, force: true });
	}
	mkdirSync(dir, { recursive: true });
}

export function deleteStoredFile(uploadsDir: string, storedName: string): void {
	if (storedName.includes('/') || storedName.includes('\\') || storedName.includes('..')) {
		return;
	}
	const full = resolve(join(uploadsDir, storedName));
	const root = resolve(uploadsDir);
	if (full !== root && !full.startsWith(root + sep)) {
		return;
	}
	if (existsSync(full)) {
		try {
			rmSync(full, { force: true });
		} catch {
			// Ignore if file could not be deleted
		}
	}
}

/**
 * Sanitize the original filename for display/metadata storage only.
 * This value is NEVER used as a filesystem path — it is purely cosmetic.
 * The stored filename is always a server-generated random UUID.
 */
export function originalBasename(filename: string): string {
	const base = filename.replace(/\\/g, '/').split('/').pop() ?? 'upload';
	const cleaned = base.replace(/[\0\r\n]/g, '').trim();
	return cleaned.length > 0 ? cleaned.slice(0, 255) : 'upload';
}

export function extensionForMime(mime: string): string {
	return MIME_EXTENSION[mime] ?? '.bin';
}

/**
 * Generate a cryptographically random stored filename.
 *
 * SECURITY: The stored filename is ALWAYS server-generated and random.
 * The user-supplied original filename is stored as metadata for display only
 * and MUST NEVER be used as a filesystem path.
 *
 * Using user-supplied names as storage paths would enable:
 * - Path traversal: "../../etc/passwd"
 * - File overwrite: "existing-file.jpg"
 * - Directory escape: "../app/index.js"
 *
 * Previous bug: newStoredName fell back to originalName when provided — fixed.
 */
export function newStoredName(mime: string): string {
	return `${randomBytes(16).toString('hex')}${extensionForMime(mime)}`;
}

/**
 * Validate a file upload for type, size, and magic byte integrity.
 * Throws HttpError 400 for any validation failure.
 *
 * Defense layers:
 * 1. MIME type allowlist (server-side config)
 * 2. File size limit
 * 3. Magic byte signature validation (defeats MIME spoofing)
 */
export function assertPermittedAttachment(mime: string, size: number, bytes?: Buffer): void {
	if (!ALLOWED_ATTACHMENT_TYPES.has(mime)) {
		securityLog('file_upload_rejected', { reason: 'disallowed_mime_type', mimeType: mime });
		throw new HttpError(400, 'bad_request', 'Attachments must be JPEG, PNG, GIF, or WebP images.');
	}
	if (size <= 0) {
		securityLog('file_upload_rejected', { reason: 'empty_file' });
		throw new HttpError(400, 'bad_request', 'Attachment file is empty.');
	}
	if (size > MAX_ATTACHMENT_BYTES) {
		securityLog('file_upload_rejected', { reason: 'file_too_large', sizeBytes: size });
		throw new HttpError(400, 'bad_request', 'Attachment must be 2 MB or smaller.');
	}
	// Magic byte validation — verify actual content matches claimed MIME type
	if (bytes && !validateMagicBytes(bytes, mime)) {
		securityLog('file_upload_rejected', {
			reason: 'magic_byte_mismatch',
			claimedMime: mime,
			sizeBytes: size
		});
		throw new HttpError(400, 'bad_request', 'File content does not match the declared file type.');
	}
}

export async function bufferFromUpload(file: File): Promise<Buffer> {
	const bytes = Buffer.from(await file.arrayBuffer());
	// Pass bytes for magic byte validation — catches MIME spoofing
	assertPermittedAttachment(file.type, bytes.byteLength, bytes);
	return bytes;
}

/**
 * Write a file to the uploads directory using a pre-validated random stored name.
 * The stored name is validated via readStoredFile's canonical path check.
 */
export function writeStoredFile(uploadsDir: string, storedName: string, bytes: Buffer): void {
	ensureUploadsDir(uploadsDir);
	// Defensive: verify the stored name does not contain path traversal
	// (should never happen as we generate it, but defense-in-depth)
	if (storedName.includes('/') || storedName.includes('\\') || storedName.includes('..')) {
		throw new HttpError(500, 'internal', 'Internal error writing attachment.');
	}
	writeFileSync(join(uploadsDir, storedName), bytes);
}

/**
 * Read a stored file safely, preventing path traversal.
 *
 * Canonical path validation ensures the resolved path is strictly inside
 * the uploads directory, even if the stored name somehow contained traversal
 * sequences (defense-in-depth against logic errors elsewhere).
 */
export function readStoredFile(uploadsDir: string, storedName: string): Buffer {
	if (storedName.includes('/') || storedName.includes('\\') || storedName.includes('..')) {
		throw new HttpError(404, 'not_found', 'Attachment file was not found.');
	}
	const root = resolve(uploadsDir);
	const full = resolve(join(uploadsDir, storedName));
	// Canonical path check: ensure the file is strictly within the uploads directory
	if (full !== root && !full.startsWith(root + sep)) {
		throw new HttpError(404, 'not_found', 'Attachment file was not found.');
	}
	if (!existsSync(full)) {
		throw new HttpError(404, 'not_found', 'Attachment file was not found.');
	}
	return readFileSync(full);
}

export function listStoredNames(uploadsDir: string): string[] {
	if (!existsSync(uploadsDir)) return [];
	return readdirSync(uploadsDir).filter((name) => name !== '.gitkeep');
}
