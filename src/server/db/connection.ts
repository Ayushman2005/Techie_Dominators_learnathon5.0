import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { applySchema } from './schema.ts';

export function openDatabase(path: string): Database.Database {
	if (path !== ':memory:') {
		mkdirSync(dirname(path), { recursive: true });
	}
	const db = new Database(path);
	db.pragma('journal_mode = WAL');
	db.pragma('synchronous = NORMAL'); // Safe with WAL; significantly faster than FULL
	db.pragma('foreign_keys = ON');
	db.pragma('temp_store = MEMORY'); // Keep temp tables in RAM
	db.pragma('cache_size = -32000'); // 32 MB page cache
	db.pragma('mmap_size = 134217728'); // 128 MB memory-mapped I/O
	applySchema(db);
	return db;
}
