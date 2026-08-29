import { existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DB_PATH, DEFAULT_UPLOADS_DIR } from '../config.ts';
import { openDatabase } from './connection.ts';
import { seedDatabase } from './seed.ts';
import { resetUploadsDir } from '../storage/attachments.ts';

import { applySchema } from './schema.ts';

function removeIfExists(path: string): void {
	if (existsSync(path)) {
		try {
			unlinkSync(path);
		} catch {
		}
	}
}

export function resetDatabase(dbPath = DEFAULT_DB_PATH, uploadsDir = DEFAULT_UPLOADS_DIR): void {
	removeIfExists(`${dbPath}-wal`);
	removeIfExists(`${dbPath}-shm`);
	removeIfExists(dbPath);
	resetUploadsDir(uploadsDir);
	const db = openDatabase(dbPath);
	db.exec('PRAGMA foreign_keys = OFF;');
	db.exec('DROP TABLE IF EXISTS attachments;');
	db.exec('DROP TABLE IF EXISTS comments;');
	db.exec('DROP TABLE IF EXISTS resolution_reviews;');
	db.exec('DROP TABLE IF EXISTS audit_logs;');
	db.exec('DROP TABLE IF EXISTS notices;');
	db.exec('DROP TABLE IF EXISTS grievances;');
	db.exec('DROP TABLE IF EXISTS sessions;');
	db.exec('DROP TABLE IF EXISTS users;');
	db.exec('DROP TABLE IF EXISTS hostels;');
	applySchema(db);
	seedDatabase(db, uploadsDir);
	db.close();
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
	resetDatabase();
	console.log('Reset complete: data/hostel.db and uploads/ restored to the seeded lab state.');
}
