<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import StatCard from '$lib/components/app/stat-card.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import { grievanceService, noticeService } from '$lib/services';
	import { getSession } from '$lib/stores/auth.svelte';
	import type { Grievance, Notice } from '$lib/types';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';
	import UserCheckIcon from '@lucide/svelte/icons/user-check';
	import HomeIcon from '@lucide/svelte/icons/home';
	import MegaphoneIcon from '@lucide/svelte/icons/megaphone';

	let grievances = $state<Grievance[]>([]);
	let notices = $state<Notice[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const user = $derived(getSession());
	const openCount = $derived(grievances.filter((g) => g.status !== 'Resolved').length);
	const resolvedCount = $derived(grievances.filter((g) => g.status === 'Resolved').length);
	const recent = $derived(grievances.slice(0, 5));

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	async function load() {
		loading = true;
		error = null;
		const uid = getSession()?.id;
		if (!uid) {
			error = 'Session unavailable.';
			loading = false;
			return;
		}
		const [grievanceRes, noticeRes] = await Promise.all([
			grievanceService.listForStudent(uid),
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

<PageHeader title="Welcome, {user?.name ?? 'Student'}" description="Your hostel grievances at a glance.">
	{#snippet actions()}
		<Button href="/student/grievances/new">
			<PlusIcon class="size-4" />
			Create Grievance
		</Button>
	{/snippet}
</PageHeader>

{#if user}
	<div class="mb-6 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-xs shadow-sm">
		<div class="flex items-center gap-1.5 font-medium text-foreground">
			<GraduationCapIcon class="size-4 text-muted-foreground" />
			<span>Student ID:</span>
			<span class="font-mono font-semibold bg-muted px-2 py-0.5 rounded border">{user.rollNo ?? user.studentId ?? '—'}</span>
		</div>
		<div class="h-4 w-px bg-border hidden sm:block"></div>
		<div class="flex items-center gap-1.5 text-muted-foreground">
			<HomeIcon class="size-3.5" />
			<span>Allocated Room:</span>
			<span class="font-mono font-medium text-foreground">{user.room ? `Room ${user.room}` : 'Unassigned'}</span>
		</div>
		<div class="h-4 w-px bg-border hidden sm:block"></div>
		<div class="flex items-center gap-1.5 text-muted-foreground">
			<UserCheckIcon class="size-3.5 text-foreground" />
			<span>Assigned Warden:</span>
			{#if user.warden}
				<span class="font-medium text-foreground">
					{user.warden.name}
					{#if user.warden.empId}
						<span class="font-mono text-[11px] text-muted-foreground">(Emp ID: {user.warden.empId})</span>
					{/if}
				</span>
			{:else}
				<span class="italic text-muted-foreground">Wing Warden</span>
			{/if}
		</div>
	</div>
{/if}

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
	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Loading" loading />
		<StatCard label="Loading" loading />
		<StatCard label="Loading" loading />
	</div>
{:else if error}
	<ErrorState message={error} onRetry={load} />
{:else}
	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Total grievances" value={grievances.length} href="/student/grievances" />
		<StatCard label="Open" value={openCount} href="/student/grievances" />
		<StatCard label="Resolved" value={resolvedCount} href="/student/grievances" />
	</div>

	<Card class="mt-6">
		<CardHeader class="flex-row items-center justify-between">
			<CardTitle>Recent grievances</CardTitle>
			<Button variant="ghost" size="sm" href="/student/grievances">
				View all
				<ArrowRightIcon class="size-4" />
			</Button>
		</CardHeader>
		<CardContent>
			{#if recent.length === 0}
				<EmptyState
					title="No grievances yet"
					description="When you file a grievance it will appear here with its current status."
					action={{ label: 'Create your first grievance', href: '/student/grievances/new' }}
				/>
			{:else}
				<ul class="divide-y">
					{#each recent as g (g.id)}
						<li>
							<a
								href="/student/grievances/{g.id}"
								class="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5"
							>
								<div class="min-w-0">
									<p class="truncate text-sm font-medium">{g.title}</p>
									<p class="text-muted-foreground text-xs">
										{g.id} · {g.category} · {formatDate(g.createdAt)}
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
