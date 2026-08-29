<script lang="ts">	import { redirect } from '@sveltejs/kit';
	import { getSession } from '$lib/stores/auth.svelte';

	const user = getSession();
	const target = user ? (user.role === 'admin' ? '/admin' : user.role === 'warden' ? '/warden' : '/student') : '/login';
	redirect(307, target);
</script>
