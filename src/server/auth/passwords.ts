import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

/**
 * Hash a plaintext password using bcrypt.
 * bcrypt is intentionally slow (key-stretching), providing resistance
 * against brute-force and rainbow-table attacks.
 * Each call produces a unique salt-embedded hash.
 */
export function hashPassword(password: string): string {
	return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 * Uses bcrypt's built-in constant-time comparison to prevent timing attacks.
 */
export function verifyPassword(password: string, stored: string): boolean {
	if (!stored || !password) return false;
	// Support legacy sha256: hashes during a migration period — always return false
	// so that users with old hashes must reset passwords.
	if (stored.startsWith('sha256:')) return false;
	try {
		return bcrypt.compareSync(password, stored);
	} catch {
		return false;
	}
}
