import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_MB } from '../config.ts';
import { HttpError } from '../http/errors.ts';
import { securityLog } from '../logger.ts';

const MIME_EXTENSION: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/gif': '.gif',
	'image/webp': '.webp',
	'application/pdf': '.pdf'
};

const MAGIC_BYTES: Array<{
	mime: string;
	signature: number[];
	offset?: number;
}> = [
	{ mime: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
	{ mime: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
	{ mime: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
	{ mime: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
	// WebP: RIFF....WEBP
	{ mime: 'image/webp', signature: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" — further validated below
	// PDF: starts with %PDF-
	{ mime: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46, 0x2d] }
];

function validateMagicBytes(bytes: Buffer, claimedMime: string): boolean {
	const matchingSignatures = MAGIC_BYTES.filter((m) => m.mime === claimedMime);
	if (matchingSignatures.length === 0) return false;

	for (const { signature, offset = 0 } of matchingSignatures) {
		if (bytes.length < offset + signature.length) continue;
		const matches = signature.every((byte, i) => bytes[offset + i] === byte);
		if (matches) {
			if (claimedMime === 'image/webp') {
				if (bytes.length < 12) continue;
				const webp = [0x57, 0x45, 0x42, 0x50];
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
		}
	}
}

export function originalBasename(filename: string): string {
	const base = filename.replace(/\\/g, '/').split('/').pop() ?? 'upload';
	const cleaned = base.replace(/[\0\r\n]/g, '').trim();
	return cleaned.length > 0 ? cleaned.slice(0, 255) : 'upload';
}

export function extensionForMime(mime: string): string {
	return MIME_EXTENSION[mime] ?? '.bin';
}

export function newStoredName(mime: string): string {
	return `${randomBytes(16).toString('hex')}${extensionForMime(mime)}`;
}

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
		throw new HttpError(400, 'bad_request', `Attachment must be ${MAX_ATTACHMENT_MB} MB or smaller.`);
	}
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
	assertPermittedAttachment(file.type, bytes.byteLength, bytes);
	return bytes;
}

export function writeStoredFile(uploadsDir: string, storedName: string, bytes: Buffer): void {
	ensureUploadsDir(uploadsDir);
	if (storedName.includes('/') || storedName.includes('\\') || storedName.includes('..')) {
		throw new HttpError(500, 'internal', 'Internal error writing attachment.');
	}
	writeFileSync(join(uploadsDir, storedName), bytes);
}

export function readStoredFile(uploadsDir: string, storedName: string): Buffer {
	if (storedName.includes('/') || storedName.includes('\\') || storedName.includes('..')) {
		throw new HttpError(404, 'not_found', 'Attachment file was not found.');
	}
	const root = resolve(uploadsDir);
	const full = resolve(join(uploadsDir, storedName));
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
