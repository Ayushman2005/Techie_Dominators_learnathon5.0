const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('data/hostel.db');
const warHash = bcrypt.hashSync('warden123', 10);
const stuHash = bcrypt.hashSync('student123', 10);
const now = new Date().toISOString();

db.exec(`INSERT OR IGNORE INTO hostels (id, name, created_at) VALUES ('hst-1', 'Boys Hostel A', '${now}');`);
db.exec(`INSERT OR IGNORE INTO hostels (id, name, created_at) VALUES ('hst-2', 'Girls Hostel B', '${now}');`);

db.exec(`
  INSERT OR IGNORE INTO users (id, name, email, password_hash, role, room, roll_no, emp_id, hostel_id, created_at)
  VALUES ('war-1', 'Mr. K. Sahu', 'warden@example.test', '${warHash}', 'warden', null, null, 'EMP-1001', 'hst-1', '${now}');
`);

db.exec(`
  INSERT OR IGNORE INTO users (id, name, email, password_hash, role, room, roll_no, emp_id, warden_id, hostel_id, created_at)
  VALUES ('stu-1', 'Aarav Mehta', 'student@example.test', '${stuHash}', 'student', 'B-204', '21BCE1042', null, 'war-1', 'hst-1', '${now}');
`);

db.exec(`
  INSERT OR IGNORE INTO grievances (id, student_id, title, category, description, priority, available_time, status, created_at, updated_at)
  VALUES ('GRV-0001', 'stu-1', 'Water leaking from bathroom ceiling', 'Water', 'Continuous dripping from the false ceiling in the main bathroom on 2nd floor.', 'high', 'Weekdays 5 PM', 'open', '${now}', '${now}');
`);

db.exec(`
  INSERT OR IGNORE INTO grievances (id, student_id, title, category, description, priority, available_time, status, created_at, updated_at)
  VALUES ('GRV-0002', 'stu-1', 'Ceiling fan making squeaking noise', 'Electricity', 'Regulator not responding smoothly and fan speed fluctuates.', 'medium', 'After 4 PM', 'in_progress', '${now}', '${now}');
`);

db.exec(`
  INSERT OR IGNORE INTO notices (id, author_id, title, body, hostel_id, created_at)
  VALUES ('ntc-1', 'war-1', 'Hostel Water Supply Maintenance Notice', 'Please note that the overhead water tank will undergo scheduled cleaning this Saturday from 10:00 AM to 2:00 PM. Water supply will be temporarily paused.', 'hst-1', '${now}');
`);

console.log('Seeded demo accounts and grievances successfully:');
console.log(db.prepare('SELECT id, name, role, email FROM users').all());
db.close();
