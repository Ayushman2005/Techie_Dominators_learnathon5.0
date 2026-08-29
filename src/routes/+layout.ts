import { redirect } from '@sveltejs/kit';
import { getSession } from '$lib/stores/auth.svelte';
import type { LayoutLoad } from './$types';

export const ssr = false;

export const load: LayoutLoad = ({ url }) => {
	const user = getSession();

	if (url.pathname === '/login') {
		if (user) {
			const target = user.role === 'admin' ? '/admin' : user.role === 'warden' ? '/warden' : '/student';
			redirect(307, target);
		}
		return {};
	}

	if (!user) {
		redirect(307, '/login');
	}

	const prefix = user.role === 'admin' ? '/admin' : user.role === 'warden' ? '/warden' : '/student';
	if (!url.pathname.startsWith(prefix)) {
		redirect(307, prefix);
	}

	return {};
};
