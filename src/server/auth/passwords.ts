import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

export function hashPassword(password: string): string {
	return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, stored: string): boolean {
	if (!stored || !password) return false;
	if (stored.startsWith('sha256:')) return false;
	try {
		return bcrypt.compareSync(password, stored);
	} catch {
		return false;
	}
}
