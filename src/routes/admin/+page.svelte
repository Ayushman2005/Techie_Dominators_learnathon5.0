<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import StatCard from '$lib/components/app/stat-card.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import { grievanceService, userService } from '$lib/services';
	import type { Grievance } from '$lib/types';
	import type { UserStats } from '$lib/services/types';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import UsersIcon from '@lucide/svelte/icons/users';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';

	let grievances = $state<Grievance[]>([]);
	let userStats = $state<UserStats | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const openCount = $derived(grievances.filter((g) => g.status === 'Open').length);
	const inProgressCount = $derived(grievances.filter((g) => g.status === 'In Progress').length);
	const resolvedCount = $derived(grievances.filter((g) => g.status === 'Resolved').length);
	const recent = $derived(grievances.slice(0, 6));

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	async function load() {
		loading = true;
		error = null;

		const [grvRes, statRes] = await Promise.all([
			grievanceService.listAll(),
			userService.getStats()
		]);

		if (grvRes.ok) {
			grievances = grvRes.data;
		} else {
			error = grvRes.error;
		}

		if (statRes.ok) {
			userStats = statRes.data;
		}

		loading = false;
	}

	load();
</script>

<svelte:head><title>Admin Dashboard · HostelGrievance</title></svelte:head>

<PageHeader
	title="Administrator Portal"
	description="System-wide administration, user management, and grievance oversight."
>
	{#snippet actions()}
		<div class="flex items-center gap-2">
			<Button variant="outline" href="/admin/users">
				<UsersIcon class="mr-1.5 size-4" />
				Manage Users
			</Button>
			<Button href="/admin/grievances">
				<ClipboardListIcon class="mr-1.5 size-4" />
				All Grievances
			</Button>
		</div>
	{/snippet}
</PageHeader>

{#if loading}
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard label="Loading" loading />
		<StatCard label="Loading" loading />
		<StatCard label="Loading" loading />
		<StatCard label="Loading" loading />
	</div>
{:else if error}
	<ErrorState message={error} onRetry={load} />
{:else}
	<!-- Grievance metrics -->
	<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Grievance Overview</h2>
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard label="Total Grievances" value={grievances.length} href="/admin/grievances" />
		<StatCard label="Pending (Open)" value={openCount} href="/admin/grievances" />
		<StatCard label="In Progress" value={inProgressCount} href="/admin/grievances" />
		<StatCard label="Resolved" value={resolvedCount} href="/admin/grievances" />
	</div>

	<!-- User account metrics -->
	<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-8 mb-3">User Distribution</h2>
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card class="bg-card">
			<CardHeader class="pb-2">
				<CardDescription class="text-xs">Registered Students</CardDescription>
				<CardTitle class="text-2xl font-bold">{userStats?.student ?? 0}</CardTitle>
			</CardHeader>
			<CardContent>
				<p class="text-xs text-muted-foreground">Hostel residents</p>
			</CardContent>
		</Card>

		<Card class="bg-card">
			<CardHeader class="pb-2">
				<CardDescription class="text-xs">Wardens</CardDescription>
				<CardTitle class="text-2xl font-bold">{userStats?.warden ?? 0}</CardTitle>
			</CardHeader>
			<CardContent>
				<p class="text-xs text-muted-foreground">Hostel supervisors</p>
			</CardContent>
		</Card>

		<Card class="bg-card">
			<CardHeader class="pb-2">
				<CardDescription class="text-xs">System Administrators</CardDescription>
				<CardTitle class="text-2xl font-bold">{userStats?.admin ?? 0}</CardTitle>
			</CardHeader>
			<CardContent>
				<p class="text-xs text-muted-foreground">Full system privilege</p>
			</CardContent>
		</Card>

		<Card class="bg-primary/5 border-primary/20 flex flex-col justify-center p-4">
			<div class="flex items-center gap-3">
				<div class="size-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
					<ShieldCheckIcon class="size-5" />
				</div>
				<div>
					<p class="text-xs font-semibold text-foreground">RBAC Enforcement</p>
					<p class="text-[11px] text-muted-foreground">Role isolation active</p>
				</div>
			</div>
			<Button variant="outline" size="sm" href="/admin/users" class="mt-3 w-full text-xs">
				<UserPlusIcon class="mr-1.5 size-3.5" />
				Add / Manage Users
			</Button>
		</Card>
	</div>

	<!-- Recent grievances -->
	<Card class="mt-8">
		<CardHeader class="flex-row items-center justify-between">
			<div>
				<CardTitle>Recent Activity & Grievances</CardTitle>
				<CardDescription>Latest complaints filed across all university hostels.</CardDescription>
			</div>
			<Button variant="ghost" size="sm" href="/admin/grievances">
				View all
				<ArrowRightIcon class="ml-1 size-4" />
			</Button>
		</CardHeader>
		<CardContent>
			{#if recent.length === 0}
				<EmptyState title="No grievances yet" description="No complaints have been recorded." />
			{:else}
				<ul class="divide-y">
					{#each recent as g (g.id)}
						<li>
							<a
								href="/admin/grievances/{g.id}"
								class="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-3 py-3 transition-colors"
							>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="font-mono text-xs text-muted-foreground">{g.id}</span>
										<p class="truncate text-sm font-semibold">{g.title}</p>
									</div>
									<p class="text-muted-foreground mt-0.5 text-xs">
										<span class="font-medium text-foreground">{g.student.name}</span>
										({g.student.room ?? 'No room'}) · {g.category} · {formatDate(g.createdAt)}
									</p>
								</div>
								<div class="flex items-center gap-3 shrink-0">
									<StatusBadge status={g.status} />
									<ArrowRightIcon class="size-4 text-muted-foreground" />
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</CardContent>
	</Card>
{/if}
