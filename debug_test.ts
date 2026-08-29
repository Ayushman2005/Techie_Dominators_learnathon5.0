import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './src/server/db/setup.ts';
import { seedDatabase } from './src/server/db/seed.ts';
import { listGrievancesFiltered } from './src/server/db/queries.ts';

const dir = mkdtempSync(join(tmpdir(), 'hg-debug-'));
const db = openDatabase(join(dir, 'hostel.db'));
const uploadDir = join(dir, 'uploads');
seedDatabase(db, uploadDir);

console.log("Users in DB:");
const users = db.prepare('SELECT id, name, role, warden_id, hostel_id FROM users').all();
console.table(users);

console.log("Grievances in DB:");
const grvs = db.prepare('SELECT id, student_id FROM grievances').all();
console.table(grvs);

console.log("Warden 1 filtering:");
const result = listGrievancesFiltered(db, { role: 'warden', userId: 'war-1', hostelId: 'hst-1' });
console.log("Total matched:", result.total);
console.log("Rows:", result.rows.length);
if (result.rows.length > 0) {
  console.log("Sample:", result.rows[0].id);
}

db.close();
rmSync(dir, { recursive: true, force: true });
