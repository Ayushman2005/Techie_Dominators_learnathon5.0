import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from 'better-sqlite3';
import { hashPassword } from '../auth/passwords.ts';
import { ensureUploadsDir, newStoredName } from '../storage/attachments.ts';

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

const JPEG = Buffer.from(
	'/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAG/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPwB//9k=',
	'base64'
);

export function seedDatabase(db: Database, uploadsDir: string): void {
	ensureUploadsDir(uploadsDir);
	const studentHash = hashPassword('student123');
	const wardenHash = hashPassword('warden123');
	const adminHash = hashPassword('admin123');

	const insertUser = db.prepare(
		`INSERT INTO users (id, name, email, password_hash, role, room, roll_no, emp_id, warden_id, created_at)
     VALUES (@id, @name, @email, @password_hash, @role, @room, @roll_no, @emp_id, @warden_id, @created_at)`
	);

	const users = [
		{
			id: 'adm-1',
			name: 'Dr. S. K. Panda (Admin)',
			email: 'admin@example.test',
			password_hash: adminHash,
			role: 'admin',
			room: null,
			roll_no: null,
			emp_id: 'ADM-0001',
			warden_id: null,
			created_at: '2026-08-01T08:00:00.000Z'
		},
		{
			id: 'war-1',
			name: 'Mr. K. Sahu',
			email: 'warden@example.test',
			password_hash: wardenHash,
			role: 'warden',
			room: null,
			roll_no: null,
			emp_id: 'EMP-1001',
			warden_id: null,
			created_at: '2026-08-01T08:00:00.000Z'
		},
		{
			id: 'war-2',
			name: 'Mr. R. K. Mishra',
			email: 'warden2@example.test',
			password_hash: wardenHash,
			role: 'warden',
			room: null,
			roll_no: null,
			emp_id: 'EMP-1002',
			warden_id: null,
			created_at: '2026-08-01T08:00:00.000Z'
		},
		{
			id: 'stu-1',
			name: 'Aarav Mehta',
			email: 'student@example.test',
			password_hash: studentHash,
			role: 'student',
			room: 'B-204',
			roll_no: '21BCE1042',
			emp_id: null,
			warden_id: 'war-1',
			created_at: '2026-08-01T08:00:00.000Z'
		},
		{
			id: 'stu-2',
			name: 'Priya Nair',
			email: 'priya@example.test',
			password_hash: studentHash,
			role: 'student',
			room: 'A-112',
			roll_no: '21BCE1088',
			emp_id: null,
			warden_id: 'war-1',
			created_at: '2026-08-01T08:00:00.000Z'
		},
		{
			id: 'stu-3',
			name: 'Rohan Das',
			email: 'rohan@example.test',
			password_hash: studentHash,
			role: 'student',
			room: 'C-008',
			roll_no: '22BCS2015',
			emp_id: null,
			warden_id: 'war-2',
			created_at: '2026-08-01T08:00:00.000Z'
		}
	];

	const insertGrievance = db.prepare(
		`INSERT INTO grievances (id, student_id, title, category, description, status, created_at, updated_at)
     VALUES (@id, @student_id, @title, @category, @description, @status, @created_at, @updated_at)`
	);

	const grievances = [
		{
			id: 'GRV-0001',
			student_id: 'stu-1',
			title: 'Water leaking from bathroom ceiling',
			category: 'Water',
			description:
				'Since Monday there has been a steady leak from the ceiling of the attached bathroom in B-204. Water pools on the floor and has started dripping near the electrical switch board, which feels unsafe.',
			status: 'in_progress',
			created_at: '2026-08-13T09:15:00.000Z',
			updated_at: '2026-08-14T10:12:00.000Z'
		},
		{
			id: 'GRV-0002',
			student_id: 'stu-1',
			title: 'Corridor tube lights not working',
			category: 'Electricity',
			description:
				'Both tube lights in the second floor corridor of Block B have been non-functional for four days. The corridor is completely dark after 7pm.',
			status: 'in_progress',
			created_at: '2026-08-14T18:30:00.000Z',
			updated_at: '2026-08-15T07:45:00.000Z'
		},
		{
			id: 'GRV-0003',
			student_id: 'stu-2',
			title: 'Hostel Wi-Fi drops every few hours',
			category: 'Internet',
			description:
				'The Wi-Fi in Block A disconnects repeatedly, especially between 8pm and midnight. Speed tests show under 1 Mbps when connected. Attached a screenshot from yesterday.',
			status: 'open',
			created_at: '2026-08-15T20:10:00.000Z',
			updated_at: '2026-08-16T08:40:00.000Z'
		},
		{
			id: 'GRV-0004',
			student_id: 'stu-3',
			title: 'Third floor common area not cleaned',
			category: 'Cleanliness',
			description:
				'The common room and corridor on the third floor of Block C have not been swept for over a week. Dust bins are overflowing in the morning.',
			status: 'resolved',
			created_at: '2026-08-12T07:00:00.000Z',
			updated_at: '2026-08-17T06:00:00.000Z'
		},
		{
			id: 'GRV-0005',
			student_id: 'stu-2',
			title: 'Window latch broken in A-112',
			category: 'Room',
			description:
				'The window latch in room A-112 is broken and the window cannot be secured. Rain water entered during last week’s storm and damaged books kept near the sill.',
			status: 'open',
			created_at: '2026-08-18T11:25:00.000Z',
			updated_at: '2026-08-18T11:25:00.000Z'
		},
		{
			id: 'GRV-0006',
			student_id: 'stu-3',
			title: 'Generator noise near C block at night',
			category: 'Maintenance',
			description:
				'The backup generator behind C block runs for long stretches at night and the noise makes it difficult to sleep in the rooms facing the rear. Requesting it be serviced or sound-proofed.',
			status: 'in_progress',
			created_at: '2026-08-17T21:45:00.000Z',
			updated_at: '2026-08-18T16:02:00.000Z'
		},
		{
			id: 'GRV-0007',
			student_id: 'stu-3',
			title: 'Low water pressure on mornings',
			category: 'Water',
			description:
				'Water pressure on taps in C block drops sharply between 6am and 8am. Buckets take very long to fill. It normalises after 9am.',
			status: 'resolved',
			created_at: '2026-08-11T06:50:00.000Z',
			updated_at: '2026-08-16T03:30:00.000Z'
		},
		{
			id: 'GRV-0008',
			student_id: 'stu-1',
			title: 'Mess tables not wiped before dinner',
			category: 'Other',
			description:
				'For the past few days the dining tables in the mess are not wiped before dinner service. Requesting the housekeeping staff to follow the standard routine.',
			status: 'open',
			created_at: '2026-08-19T13:05:00.000Z',
			updated_at: '2026-08-19T13:05:00.000Z'
		}
	];

	const insertComment = db.prepare(
		`INSERT INTO comments (id, grievance_id, author_id, body, created_at)
     VALUES (@id, @grievance_id, @author_id, @body, @created_at)`
	);

	const comments = [
		{
			id: 'cmt-1',
			grievance_id: 'GRV-0001',
			author_id: 'war-1',
			body: 'Logged this with the plumbing team. They will visit on Tuesday between 10am and noon.',
			created_at: '2026-08-14T05:30:00.000Z'
		},
		{
			id: 'cmt-2',
			grievance_id: 'GRV-0001',
			author_id: 'stu-1',
			body: 'Thank you. The leak has gotten slightly worse, water is reaching the wardrobe now.',
			created_at: '2026-08-14T09:05:00.000Z'
		},
		{
			id: 'cmt-3',
			grievance_id: 'GRV-0001',
			author_id: 'war-1',
			body: 'Noted — I have flagged it as priority for the visit.',
			created_at: '2026-08-14T10:12:00.000Z'
		},
		{
			id: 'cmt-4',
			grievance_id: 'GRV-0002',
			author_id: 'war-1',
			body: 'Electrician inspected the fitting; replacement tube lights have been ordered.',
			created_at: '2026-08-15T07:45:00.000Z'
		},
		{
			id: 'cmt-5',
			grievance_id: 'GRV-0003',
			author_id: 'war-1',
			body: 'ISP has been notified about the outage in Block A. Escalation reference: #48211.',
			created_at: '2026-08-16T04:20:00.000Z'
		},
		{
			id: 'cmt-6',
			grievance_id: 'GRV-0003',
			author_id: 'stu-2',
			body: 'It came back for an hour yesterday evening and dropped again.',
			created_at: '2026-08-16T08:40:00.000Z'
		},
		{
			id: 'cmt-7',
			grievance_id: 'GRV-0004',
			author_id: 'war-1',
			body: 'Cleaning schedule for the third floor has been revised. Marking this resolved — please reopen if it regresses.',
			created_at: '2026-08-17T06:00:00.000Z'
		},
		{
			id: 'cmt-8',
			grievance_id: 'GRV-0006',
			author_id: 'stu-3',
			body: 'Requesting an update when possible — the noise makes it hard to sleep.',
			created_at: '2026-08-18T15:10:00.000Z'
		},
		{
			id: 'cmt-9',
			grievance_id: 'GRV-0006',
			author_id: 'war-1',
			body: 'Generator maintenance is booked for Friday. Apologies for the disturbance.',
			created_at: '2026-08-18T16:02:00.000Z'
		},
		{
			id: 'cmt-10',
			grievance_id: 'GRV-0007',
			author_id: 'war-1',
			body: 'Water tank was cleaned and refilled on Sunday. Confirming supply is normal.',
			created_at: '2026-08-16T03:30:00.000Z'
		}
	];

	const insertAttachment = db.prepare(
		`INSERT INTO attachments (id, grievance_id, original_filename, stored_filename, mime_type, size_bytes, data, created_at)
     VALUES (@id, @grievance_id, @original_filename, @stored_filename, @mime_type, @size_bytes, @data, @created_at)`
	);

	const insertAuditLog = db.prepare(
		`INSERT INTO audit_logs (id, event_type, action, actor_id, actor_name, actor_email, actor_role, target_id, target_type, details, ip_address, status, created_at)
     VALUES (@id, @event_type, @action, @actor_id, @actor_name, @actor_email, @actor_role, @target_id, @target_type, @details, @ip_address, @status, @created_at)`
	);

	const auditLogs = [
		{
			id: 'aud-1',
			event_type: 'user.created',
			action: 'System initialized administrator account',
			actor_id: 'adm-1',
			actor_name: 'Dr. S. K. Panda (Admin)',
			actor_email: 'admin@example.test',
			actor_role: 'admin',
			target_id: 'adm-1',
			target_type: 'user',
			details: JSON.stringify({ role: 'admin', setup: true }),
			ip_address: '127.0.0.1',
			status: 'success',
			created_at: '2026-08-01T08:00:00.000Z'
		},
		{
			id: 'aud-2',
			event_type: 'user.created',
			action: 'Warden registered student: Aarav Mehta',
			actor_id: 'war-1',
			actor_name: 'Mr. K. Sahu',
			actor_email: 'warden@example.test',
			actor_role: 'warden',
			target_id: 'stu-1',
			target_type: 'user',
			details: JSON.stringify({ name: 'Aarav Mehta', email: 'student@example.test', room: 'B-204', role: 'student' }),
			ip_address: '192.168.1.45',
			status: 'success',
			created_at: '2026-08-01T08:05:00.000Z'
		},
		{
			id: 'aud-3',
			event_type: 'auth.login_success',
			action: 'Signed in as student',
			actor_id: 'stu-1',
			actor_name: 'Aarav Mehta',
			actor_email: 'student@example.test',
			actor_role: 'student',
			target_id: 'stu-1',
			target_type: 'user',
			details: JSON.stringify({ device: 'Mobile Safari' }),
			ip_address: '192.168.1.102',
			status: 'success',
			created_at: '2026-08-13T09:10:00.000Z'
		},
		{
			id: 'aud-4',
			event_type: 'grievance.created',
			action: 'Filed complaint: Water leaking from bathroom ceiling',
			actor_id: 'stu-1',
			actor_name: 'Aarav Mehta',
			actor_email: 'student@example.test',
			actor_role: 'student',
			target_id: 'GRV-0001',
			target_type: 'grievance',
			details: JSON.stringify({ category: 'Water', studentRoom: 'B-204', priority: 'high' }),
			ip_address: '192.168.1.102',
			status: 'success',
			created_at: '2026-08-13T09:15:00.000Z'
		},
		{
			id: 'aud-5',
			event_type: 'attachment.uploaded',
			action: 'Uploaded attachment for GRV-0001',
			actor_id: 'stu-1',
			actor_name: 'Aarav Mehta',
			actor_email: 'student@example.test',
			actor_role: 'student',
			target_id: 'GRV-0001',
			target_type: 'grievance_attachment',
			details: JSON.stringify({ filename: 'leaking-tap.jpg', mimeType: 'image/jpeg', sizeBytes: 1540 }),
			ip_address: '192.168.1.102',
			status: 'success',
			created_at: '2026-08-13T09:15:00.000Z'
		},
		{
			id: 'aud-6',
			event_type: 'auth.login_success',
			action: 'Signed in as warden',
			actor_id: 'war-1',
			actor_name: 'Mr. K. Sahu',
			actor_email: 'warden@example.test',
			actor_role: 'warden',
			target_id: 'war-1',
			target_type: 'user',
			details: JSON.stringify({ device: 'Chrome Desktop' }),
			ip_address: '192.168.1.45',
			status: 'success',
			created_at: '2026-08-13T11:00:00.000Z'
		},
		{
			id: 'aud-7',
			event_type: 'comment.created',
			action: 'Warden responded to grievance #GRV-0001',
			actor_id: 'war-1',
			actor_name: 'Mr. K. Sahu',
			actor_email: 'warden@example.test',
			actor_role: 'warden',
			target_id: 'GRV-0001',
			target_type: 'grievance',
			details: JSON.stringify({ grievanceTitle: 'Water leaking from bathroom ceiling', commentSnippet: 'Plumber Mr. Ramesh has been notified...' }),
			ip_address: '192.168.1.45',
			status: 'success',
			created_at: '2026-08-13T11:30:00.000Z'
		},
		{
			id: 'aud-8',
			event_type: 'grievance.status_changed',
			action: 'Warden updated status to In Progress',
			actor_id: 'war-1',
			actor_name: 'Mr. K. Sahu',
			actor_email: 'warden@example.test',
			actor_role: 'warden',
			target_id: 'GRV-0001',
			target_type: 'grievance',
			details: JSON.stringify({ grievanceTitle: 'Water leaking from bathroom ceiling', oldStatus: 'Open', newStatus: 'In Progress' }),
			ip_address: '192.168.1.45',
			status: 'success',
			created_at: '2026-08-14T10:12:00.000Z'
		},
		{
			id: 'aud-9',
			event_type: 'grievance.created',
			action: 'Filed complaint: Corridor tube lights not working',
			actor_id: 'stu-1',
			actor_name: 'Aarav Mehta',
			actor_email: 'student@example.test',
			actor_role: 'student',
			target_id: 'GRV-0002',
			target_type: 'grievance',
			details: JSON.stringify({ category: 'Electricity', studentRoom: 'B-204' }),
			ip_address: '192.168.1.102',
			status: 'success',
			created_at: '2026-08-14T18:30:00.000Z'
		},
		{
			id: 'aud-10',
			event_type: 'grievance.status_changed',
			action: 'Warden updated status to Resolved',
			actor_id: 'war-1',
			actor_name: 'Mr. K. Sahu',
			actor_email: 'warden@example.test',
			actor_role: 'warden',
			target_id: 'GRV-0002',
			target_type: 'grievance',
			details: JSON.stringify({ grievanceTitle: 'Corridor tube lights not working', oldStatus: 'Open', newStatus: 'Resolved' }),
			ip_address: '192.168.1.45',
			status: 'success',
			created_at: '2026-08-15T14:45:00.000Z'
		}
	];

	db.transaction(() => {
		for (const user of users) insertUser.run(user);
		for (const g of grievances) insertGrievance.run(g);
		for (const c of comments) insertComment.run(c);
		for (const log of auditLogs) insertAuditLog.run(log);

		const files = [
			{
				id: 'att-1',
				grievance_id: 'GRV-0001',
				original_filename: 'leaking-tap.jpg',
				mime_type: 'image/jpeg',
				bytes: JPEG,
				created_at: '2026-08-13T09:15:00.000Z'
			},
			{
				id: 'att-2',
				grievance_id: 'GRV-0002',
				original_filename: 'corridor-light-off.png',
				mime_type: 'image/png',
				bytes: PNG,
				created_at: '2026-08-14T18:30:00.000Z'
			},
			{
				id: 'att-3',
				grievance_id: 'GRV-0003',
				original_filename: 'wifi-speedtest.png',
				mime_type: 'image/png',
				bytes: PNG,
				created_at: '2026-08-15T20:10:00.000Z'
			},
			{
				id: 'att-4',
				grievance_id: 'GRV-0008',
				original_filename: 'mess-area.jpg',
				mime_type: 'image/jpeg',
				bytes: JPEG,
				created_at: '2026-08-19T13:05:00.000Z'
			}
		];

		for (const file of files) {
			const stored = newStoredName(file.mime_type);
			writeFileSync(join(uploadsDir, stored), file.bytes);
			insertAttachment.run({
				id: file.id,
				grievance_id: file.grievance_id,
				original_filename: file.original_filename,
				stored_filename: stored,
				mime_type: file.mime_type,
				size_bytes: file.bytes.byteLength,
				data: null,
				created_at: file.created_at
			});
		}
	})();
}
