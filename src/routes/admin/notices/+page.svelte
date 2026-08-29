<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import MegaphoneIcon from '@lucide/svelte/icons/megaphone';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { noticeService } from '$lib/services';
	import type { Notice } from '$lib/types';

	let notices = $state<Notice[]>([]);
	let loading = $state(true);
	let formSubmitting = $state(false);

	let title = $state('');
	let body = $state('');

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

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		if (!title.trim() || !body.trim()) {
			toast.error('Title and body are required.');
			return;
		}
		formSubmitting = true;
		const result = await noticeService.create({
			title: title.trim(),
			body: body.trim(),
			hostel_id: null
		});
		if (result.ok) {
			toast.success('Notice broadcasted to entire hostel successfully.');
			title = '';
			body = '';
			await loadNotices();
		} else {
			toast.error('Could not create notice', { description: result.error });
		}
		formSubmitting = false;
	}

	async function handleDelete(id: string) {
		if (!confirm('Are you sure you want to delete this notice?')) return;
		const result = await noticeService.delete(id);
		if (result.ok) {
			toast.success('Notice deleted.');
			await loadNotices();
		} else {
			toast.error('Failed to delete notice', { description: result.error });
		}
	}

	onMount(() => {
		loadNotices();
	});
</script>

<svelte:head><title>Global Notice Board · Admin Panel</title></svelte:head>

<PageHeader title="Global Notice Board" description="Broadcast important updates to the entire hostel." />

<div class="grid gap-6 md:grid-cols-3">
	<!-- Create Notice Form -->
	<div class="md:col-span-1">
		<Card>
			<CardHeader>
				<CardTitle>New Global Broadcast</CardTitle>
				<CardDescription>Publish a notice visible to everyone in the hostel.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onsubmit={handleCreate} class="space-y-4">
					<div class="space-y-2">
						<Label for="notice-title">Title</Label>
						<Input id="notice-title" bind:value={title} placeholder="e.g. Campus-wide network maintenance" required />
					</div>
					<div class="space-y-2">
						<Label for="notice-body">Message Details</Label>
						<Textarea id="notice-body" bind:value={body} placeholder="Provide more context..." class="h-32" required />
					</div>
					<Button type="submit" class="w-full" disabled={formSubmitting}>
						{formSubmitting ? 'Publishing...' : 'Publish Global Notice'}
					</Button>
				</form>
			</CardContent>
		</Card>
	</div>

	<!-- Published Notices List -->
	<div class="md:col-span-2 space-y-4">
		{#if loading}
			<div class="p-8 text-center text-muted-foreground animate-pulse">Loading notices...</div>
		{:else if notices.length === 0}
			<EmptyState
				title="No Active Notices"
				description="There are no notices published yet. Create one on the left."
			/>
		{:else}
			{#each notices as notice}
				<Card>
					<CardContent class="p-6 flex justify-between gap-4">
						<div class="space-y-1">
							<h3 class="font-semibold text-lg">{notice.title}</h3>
							<p class="text-sm text-muted-foreground whitespace-pre-wrap">{notice.body}</p>
							<div class="text-xs text-muted-foreground pt-2">
								Posted by {notice.author_name} ({notice.author_role}) on {new Date(notice.created_at).toLocaleString()}
								{#if notice.hostel_id}
									<span class="text-amber-600 font-medium ml-2">· Hostel Broadcast</span>
								{:else}
									<span class="text-blue-600 font-medium ml-2">· Global Broadcast</span>
								{/if}
							</div>
						</div>
						<div>
							<Button variant="ghost" size="icon" class="text-destructive" onclick={() => handleDelete(notice.id)}>
								<Trash2Icon class="size-4" />
							</Button>
						</div>
					</CardContent>
				</Card>
			{/each}
		{/if}
	</div>
</div>
