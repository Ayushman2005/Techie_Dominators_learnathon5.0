<script lang="ts">
	import { redirect } from '@sveltejs/kit';
	import { getSession } from '$lib/stores/auth.svelte';

	// Root entry: send the user where their session dictates.
	const user = getSession();
	const target = user ? (user.role === 'admin' ? '/admin' : user.role === 'warden' ? '/warden' : '/student') : '/login';
	redirect(307, target);
</script>
