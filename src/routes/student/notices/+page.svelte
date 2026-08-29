<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import { noticeService } from '$lib/services';
	import type { Notice } from '$lib/types';

	let notices = $state<Notice[]>([]);
	let loading = $state(true);

	async function loadNotices() {
		loading = true;
		const result = await noticeService.list();
		if (result.ok) {
			notices = result.data;
		} else {
			toast.error('Failed to load notices', { description: result.error });
		}
		loading = false;
	}

	onMount(() => {
		loadNotices();
	});
</script>

<svelte:head><title>Hostel Notice Board · Student Portal</title></svelte:head>

<PageHeader title="Hostel Notice Board" description="Important announcements and updates from your wardens and admins." />

<div class="max-w-4xl mx-auto space-y-4">
	{#if loading}
		<div class="p-8 text-center text-muted-foreground animate-pulse">Loading notices...</div>
	{:else if notices.length === 0}
		<EmptyState
			title="No Active Notices"
			description="There are no announcements right now."
		/>
	{:else}
		{#each notices as notice}
			<Card>
				<CardContent class="p-6">
					<div class="space-y-1">
						<h3 class="font-semibold text-lg">{notice.title}</h3>
						<p class="text-sm text-muted-foreground whitespace-pre-wrap">{notice.body}</p>
						<div class="text-xs text-muted-foreground pt-3 flex items-center justify-between">
							<span>
								Posted by <span class="font-medium text-foreground">{notice.author_name}</span> ({notice.author_role})
							</span>
							<span class="flex items-center gap-2">
								{#if notice.hostel_id}
									<span class="text-amber-600 font-medium">· Hostel Broadcast</span>
								{:else}
									<span class="text-blue-600 font-medium">· Global Broadcast</span>
								{/if}
								·
								<span class="font-mono">{new Date(notice.created_at).toLocaleString()}</span>
							</span>
						</div>
					</div>
				</CardContent>
			</Card>
		{/each}
	{/if}
</div>
