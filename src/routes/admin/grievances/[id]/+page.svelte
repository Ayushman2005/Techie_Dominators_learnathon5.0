<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import DetailSkeleton from '$lib/components/app/detail-skeleton.svelte';
	import CommentTimeline from '$lib/components/app/comment-timeline.svelte';
	import CommentForm from '$lib/components/app/comment-form.svelte';
	import AttachmentCard from '$lib/components/app/attachment-card.svelte';
	import { commentService, grievanceService } from '$lib/services';
	import { getSession } from '$lib/stores/auth.svelte';
	import { GRIEVANCE_STATUSES, type Grievance, type GrievanceStatus } from '$lib/types';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';

	const grievanceId = $derived(page.params.id ?? '');

	let grievance = $state<Grievance | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let commenting = $state(false);
	let changingStatus = $state(false);
	let deleteDialogOpen = $state(false);
	let deleting = $state(false);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString('en-IN', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function load() {
		loading = true;
		notFound = false;
		const result = await grievanceService.getById(grievanceId);
		if (result.ok) {
			grievance = result.data;
		} else {
			grievance = null;
			notFound = true;
		}
		loading = false;
	}

	$effect(() => {
		if (grievanceId) load();
	});

	async function handleAddComment(body: string): Promise<boolean> {
		const uid = getSession()?.id;
		if (!uid || !grievance) return false;
		commenting = true;
		const result = await commentService.add(grievance.id, uid, body);
		commenting = false;
		if (result.ok) {
			grievance = { ...grievance, comments: [...grievance.comments, result.data] };
			return true;
		}
		return false;
	}

	async function handleStatusChange(next: string) {
		if (!grievance || next === grievance.status) return;
		changingStatus = true;
		const result = await grievanceService.updateStatus(grievance.id, next as GrievanceStatus);
		changingStatus = false;
		if (result.ok) {
			grievance = result.data;
			toast.success(`Status updated to "${result.data.status}".`);
		} else {
			toast.error('Could not update status.', { description: result.error });
		}
	}

	async function handleDelete() {
		if (!grievance) return;
		deleting = true;
		const result = await grievanceService.delete(grievance.id);
		deleting = false;

		if (result.ok) {
			toast.success(`Grievance ${grievance.id} deleted.`);
			deleteDialogOpen = false;
			await goto('/admin/grievances', { replaceState: true });
		} else {
			toast.error('Could not delete grievance.', { description: result.error });
		}
	}
</script>

<svelte:head><title>Grievance {grievanceId} · Admin Portal</title></svelte:head>

<div class="mb-4 flex items-center justify-between">
	<Button variant="ghost" size="sm" href="/admin/grievances" class="gap-1.5">
		<ArrowLeftIcon class="size-4" />
		Back to all grievances
	</Button>
	{#if grievance}
		<Button
			variant="outline"
			size="sm"
			class="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 gap-1.5"
			onclick={() => (deleteDialogOpen = true)}
		>
			<Trash2Icon class="size-3.5" />
			Delete Grievance
		</Button>
	{/if}
</div>

{#if loading}
	<DetailSkeleton />
{:else if notFound || !grievance}
	<ErrorState
		title="Grievance not found"
		message="This grievance does not exist or may have been deleted."
	/>
	<div class="mt-4">
		<Button variant="outline" href="/admin/grievances">Return to list</Button>
	</div>
{:else}
	<PageHeader title={grievance.title} description="Filed by {grievance.student.name} ({grievance.student.room ?? 'No room assigned'})">
		{#snippet actions()}
			<div class="flex items-center gap-2">
				{#if grievance}
					<StatusBadge status={grievance.status} />
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<div class="grid gap-6 lg:grid-cols-3">
		<div class="space-y-6 lg:col-span-2">
			<!-- Grievance Description -->
			<Card>
				<CardHeader>
					<CardTitle>Description</CardTitle>
				</CardHeader>
				<CardContent>
					<p class="text-sm leading-relaxed whitespace-pre-wrap">{grievance.description}</p>
				</CardContent>
			</Card>

			<!-- Attachments -->
			{#if grievance.attachments.length > 0}
				<Card>
					<CardHeader>
						<CardTitle>Attachments ({grievance.attachments.length})</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="grid gap-3 sm:grid-cols-2">
							{#each grievance.attachments as a (a.id)}
								<AttachmentCard attachment={a} />
							{/each}
						</div>
					</CardContent>
				</Card>
			{/if}

			<!-- Comments Timeline & Form -->
			<Card>
				<CardHeader>
					<CardTitle>Discussion & Investigation Log</CardTitle>
					<CardDescription>
						All communication between student, warden, and administrators.
					</CardDescription>
				</CardHeader>
				<CardContent class="space-y-6">
					<CommentTimeline comments={grievance.comments} />
					<Separator />
					<div class="space-y-2">
						<div class="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
							<ShieldCheckIcon class="size-3.5 text-primary" />
							Post official Administrator Comment
						</div>
						<CommentForm onSubmit={handleAddComment} submitting={commenting} />
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Sidebar: Details and Status Control -->
		<div class="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Status Control</CardTitle>
					<CardDescription>Admin override for grievance workflow status.</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="space-y-2">
						<label for="admin-status-select" class="text-xs font-medium text-muted-foreground">Current Status</label>
						<select
							id="admin-status-select"
							class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							value={grievance.status}
							disabled={changingStatus}
							onchange={(e) => handleStatusChange((e.target as HTMLSelectElement).value)}
						>
							{#each GRIEVANCE_STATUSES as s}
								<option value={s}>{s}</option>
							{/each}
						</select>
					</div>
					<p class="text-[11px] text-muted-foreground">
						Updating status immediately notifies hostel staff and the student.
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Grievance Information</CardTitle>
				</CardHeader>
				<CardContent class="text-xs space-y-3">
					<div>
						<span class="text-muted-foreground block text-[11px]">Grievance ID</span>
						<span class="font-mono font-semibold">{grievance.id}</span>
					</div>
					<div>
						<span class="text-muted-foreground block text-[11px]">Category</span>
						<span class="font-medium">{grievance.category}</span>
					</div>
					<div>
						<span class="text-muted-foreground block text-[11px]">Student</span>
						<span class="font-medium">{grievance.student.name}</span>
						<span class="text-muted-foreground block">{grievance.student.email}</span>
					</div>
					<div>
						<span class="text-muted-foreground block text-[11px]">Hostel Room</span>
						<span class="font-medium">{grievance.student.room ?? 'Not specified'}</span>
					</div>
					<div>
						<span class="text-muted-foreground block text-[11px]">Date Created</span>
						<span>{formatDate(grievance.createdAt)}</span>
					</div>
					<div>
						<span class="text-muted-foreground block text-[11px]">Last Updated</span>
						<span>{formatDate(grievance.updatedAt)}</span>
					</div>
				</CardContent>
			</Card>
		</div>
	</div>
{/if}

<!-- DELETE GRIEVANCE CONFIRMATION DIALOG -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete Grievance {grievance?.id}</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to permanently delete this grievance and all associated data? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="pt-3">
			<Button type="button" variant="outline" onclick={() => (deleteDialogOpen = false)}>Cancel</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={deleting}>
				{deleting ? 'Deleting…' : 'Delete Permanently'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
