<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import StatCard from '$lib/components/app/stat-card.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import { grievanceService, noticeService } from '$lib/services';
	import type { Grievance, Notice } from '$lib/types';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import MegaphoneIcon from '@lucide/svelte/icons/megaphone';

	let grievances = $state<Grievance[]>([]);
	let notices = $state<Notice[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const openCount = $derived(grievances.filter((g) => g.status === 'Open').length);
	const inProgressCount = $derived(grievances.filter((g) => g.status === 'In Progress').length);
	const resolvedCount = $derived(grievances.filter((g) => g.status === 'Resolved').length);
	const recent = $derived(grievances.slice(0, 5));

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	async function load() {
		loading = true;
		error = null;
		const [grievanceRes, noticeRes] = await Promise.all([
			grievanceService.listAll(),
			noticeService.list()
		]);

		if (grievanceRes.ok) {
			grievances = grievanceRes.data;
		} else {
			error = grievanceRes.error;
		}

		if (noticeRes.ok) {
			notices = noticeRes.data;
		}
		
		loading = false;
	}

	load();
</script>

<svelte:head><title>Dashboard · HostelGrievance</title></svelte:head>

<PageHeader title="Warden dashboard" description="Grievances across all hostel students.">
	{#snippet actions()}
		<Button variant="outline" href="/warden/grievances">
			All grievances
			<ArrowRightIcon class="size-4" />
		</Button>
	{/snippet}
</PageHeader>

{#if notices.length > 0}
	<div class="mb-6 space-y-3">
		{#each notices as notice}
			<div class="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
				<MegaphoneIcon class="mt-0.5 size-5 text-primary shrink-0" />
				<div class="space-y-1">
					<h4 class="font-semibold text-primary">{notice.title}</h4>
					<p class="text-muted-foreground whitespace-pre-wrap">{notice.body}</p>
					<div class="text-xs text-primary/70 pt-1">
						Posted by {notice.author_name} ({notice.author_role}) on {new Date(notice.created_at).toLocaleString()}
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

{#if loading}
	<div class="grid gap-4 sm:grid-cols-4">
		<StatCard label="Loading" loading />
		<StatCard label="Loading" loading />
		<StatCard label="Loading" loading />
		<StatCard label="Loading" loading />
	</div>
{:else if error}
	<ErrorState message={error} onRetry={load} />
{:else}
	<div class="grid gap-4 sm:grid-cols-4">
		<StatCard label="Total" value={grievances.length} href="/warden/grievances" />
		<StatCard label="Open" value={openCount} href="/warden/grievances" />
		<StatCard label="In progress" value={inProgressCount} href="/warden/grievances" />
		<StatCard label="Resolved" value={resolvedCount} href="/warden/grievances" />
	</div>

	<Card class="mt-6">
		<CardHeader class="flex-row items-center justify-between">
			<CardTitle>Recent grievances</CardTitle>
			<Button variant="ghost" size="sm" href="/warden/grievances">
				View all
				<ArrowRightIcon class="size-4" />
			</Button>
		</CardHeader>
		<CardContent>
			{#if recent.length === 0}
				<EmptyState title="No grievances yet" description="Grievances filed by students will appear here." />
			{:else}
				<ul class="divide-y">
					{#each recent as g (g.id)}
						<li>
							<a
								href="/warden/grievances/{g.id}"
								class="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5"
							>
								<div class="min-w-0">
									<p class="truncate text-sm font-medium">{g.title}</p>
									<p class="text-muted-foreground text-xs">
										{g.student.name} · {g.student.room ?? '—'} · {g.category} · {formatDate(g.createdAt)}
									</p>
								</div>
								<StatusBadge status={g.status} />
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</CardContent>
	</Card>
{/if}
