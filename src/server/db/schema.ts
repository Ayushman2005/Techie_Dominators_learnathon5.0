import type { Database } from 'better-sqlite3';

export const TABLES_SQL = `
CREATE TABLE IF NOT EXISTS hostels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'warden', 'admin')),
  room TEXT,
  roll_no TEXT,
  emp_id TEXT,
  phone TEXT,
  emergency_contact TEXT,
  warden_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  hostel_id TEXT REFERENCES hostels(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grievances (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  available_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grievance_status_history (
  id TEXT PRIMARY KEY,
  grievance_id TEXT NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  changed_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_by_name TEXT NOT NULL,
  changed_by_role TEXT NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  grievance_id TEXT NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  grievance_id TEXT NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  data BLOB,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  actor_email TEXT,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('student', 'warden', 'admin', 'system')),
  target_id TEXT,
  target_type TEXT,
  details TEXT,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure', 'warning', 'info')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resolution_reviews (
  id TEXT PRIMARY KEY,
  grievance_id TEXT NOT NULL UNIQUE REFERENCES grievances(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT NOT NULL,
  attachment_id TEXT REFERENCES attachments(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  hostel_id TEXT REFERENCES hostels(id) ON DELETE CASCADE,
  target_warden_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
`;

export const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_grievances_student ON grievances(student_id);
CREATE INDEX IF NOT EXISTS idx_grievances_status ON grievances(status);
CREATE INDEX IF NOT EXISTS idx_grievances_priority ON grievances(priority);
CREATE INDEX IF NOT EXISTS idx_grievances_category ON grievances(category);
CREATE INDEX IF NOT EXISTS idx_grievances_student_status ON grievances(student_id, status);
CREATE INDEX IF NOT EXISTS idx_grievances_created_at ON grievances(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grievances_updated_at ON grievances(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_grievance ON comments(grievance_id);
CREATE INDEX IF NOT EXISTS idx_attachments_grievance ON attachments(grievance_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role ON audit_logs(actor_role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_resolution_reviews_grievance ON resolution_reviews(grievance_id);
CREATE INDEX IF NOT EXISTS idx_resolution_reviews_student ON resolution_reviews(student_id);
CREATE INDEX IF NOT EXISTS idx_users_warden ON users(warden_id);
CREATE INDEX IF NOT EXISTS idx_users_hostel ON users(hostel_id);
CREATE INDEX IF NOT EXISTS idx_status_history_grievance ON grievance_status_history(grievance_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_roll_no ON users(roll_no) WHERE roll_no IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_emp_id ON users(emp_id) WHERE emp_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notices_author ON notices(author_id);
CREATE INDEX IF NOT EXISTS idx_notices_hostel ON notices(hostel_id);
CREATE INDEX IF NOT EXISTS idx_notices_target ON notices(target_warden_id);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON notices(created_at DESC);
`;



export function applySchema(db: Database): void {
	db.exec('PRAGMA foreign_keys = ON;');
	db.exec(TABLES_SQL);

	// Auto-migrate existing users table if columns are missing BEFORE creating indexes on those columns
	const userCols = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
	if (userCols.length > 0) {
		if (!userCols.some((c) => c.name === 'roll_no')) {
			db.exec('ALTER TABLE users ADD COLUMN roll_no TEXT;');
		}
		if (!userCols.some((c) => c.name === 'emp_id')) {
			db.exec('ALTER TABLE users ADD COLUMN emp_id TEXT;');
		}
		if (!userCols.some((c) => c.name === 'phone')) {
			db.exec('ALTER TABLE users ADD COLUMN phone TEXT;');
		}
		if (!userCols.some((c) => c.name === 'emergency_contact')) {
			db.exec('ALTER TABLE users ADD COLUMN emergency_contact TEXT;');
		}
		if (!userCols.some((c) => c.name === 'warden_id')) {
			db.exec('ALTER TABLE users ADD COLUMN warden_id TEXT REFERENCES users(id) ON DELETE SET NULL;');
		}
		if (!userCols.some((c) => c.name === 'hostel_id')) {
			db.exec('ALTER TABLE users ADD COLUMN hostel_id TEXT REFERENCES hostels(id) ON DELETE SET NULL;');
			
			// Create a default hostel and assign existing users to it
			const now = new Date().toISOString();
			db.exec(`INSERT OR IGNORE INTO hostels (id, name, created_at) VALUES ('hst-default', 'Main Hostel', '${now}');`);
			db.exec(`UPDATE users SET hostel_id = 'hst-default' WHERE hostel_id IS NULL;`);
		}
	}

	// Auto-migrate existing attachments table if data column is missing
	const cols = db.prepare(`PRAGMA table_info(attachments)`).all() as { name: string }[];
	if (cols.length > 0 && !cols.some((c) => c.name === 'data')) {
		db.exec('ALTER TABLE attachments ADD COLUMN data BLOB;');
	}

	// Auto-migrate grievances table: add priority and available_time columns if missing
	const grievanceCols = db.prepare(`PRAGMA table_info(grievances)`).all() as { name: string }[];
	if (grievanceCols.length > 0) {
		if (!grievanceCols.some((c) => c.name === 'priority')) {
			db.exec("ALTER TABLE grievances ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';");
		}
		if (!grievanceCols.some((c) => c.name === 'available_time')) {
			db.exec("ALTER TABLE grievances ADD COLUMN available_time TEXT;");
		}
	}

	// Create indexes after ensuring all referenced columns exist
	// Auto-migrate notices table: add hostel_id column if missing
	const noticeCols = db.prepare(`PRAGMA table_info(notices)`).all() as { name: string }[];
	if (noticeCols.length > 0 && !noticeCols.some((c) => c.name === 'hostel_id')) {
		db.exec('ALTER TABLE notices ADD COLUMN hostel_id TEXT REFERENCES hostels(id) ON DELETE CASCADE;');
	}

	db.exec(INDEXES_SQL);
}

