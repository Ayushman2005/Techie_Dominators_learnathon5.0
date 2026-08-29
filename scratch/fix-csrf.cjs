const fs = require('fs');
let code = fs.readFileSync('src/lib/services/api.ts', 'utf8');

const injection = `
function getCsrfToken(): string {
	if (typeof document === 'undefined') return '';
	const match = document.cookie.match(/(?:^|;\\s*)csrf_token=([^;]*)/);
	return match ? decodeURIComponent(match[1]) : '';
}

async function apiFetch(input: RequestInfo | URL | string, init?: RequestInit): Promise<Response> {
	const options = init || {};
	const method = (options.method || 'GET').toUpperCase();
	if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
		const token = getCsrfToken();
		if (token) {
			const newHeaders = new Headers(options.headers as any);
			newHeaders.set('X-CSRF-Token', token);
			options.headers = newHeaders;
		}
	}
	return fetch(input, options);
}
`;

code = code.replace(/const SESSION_KEY = 'hg\.session\.user';/, `const SESSION_KEY = 'hg.session.user';\n\n` + injection);
code = code.replaceAll('await fetch(', 'await apiFetch(');
fs.writeFileSync('src/lib/services/api.ts', code);
console.log('Done');
