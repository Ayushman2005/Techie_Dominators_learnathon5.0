<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import StatCard from '$lib/components/app/stat-card.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import { grievanceService, userService, auditLogService } from '$lib/services';
	import type { Grievance, AuditLog } from '$lib/types';
	import type { UserStats } from '$lib/services/types';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import UsersIcon from '@lucide/svelte/icons/users';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	let grievances = $state<Grievance[]>([]);
	let recentAuditLogs = $state<AuditLog[]>([]);
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

	function formatTimeAgo(iso: string): string {
		const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
		if (diff < 60) return `${Math.max(1, diff)}s ago`;
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}

	async function load() {
		loading = true;
		error = null;

		const [grvRes, statRes, auditRes] = await Promise.all([
			grievanceService.listAll(),
			userService.getStats(),
			auditLogService.list({ limit: 6 })
		]);

		if (grvRes.ok) {
			grievances = grvRes.data;
		} else {
			error = grvRes.error;
		}

		if (statRes.ok) {
			userStats = statRes.data;
		}

		if (auditRes.ok) {
			recentAuditLogs = auditRes.data.data;
		}

		loading = false;
	}

	load();
</script>

<svelte:head><title>Admin Dashboard · HostelGrievance</title></svelte:head>

<PageHeader
	title="Administrator Portal"
	description="System-wide administration, user management, audit surveillance, and grievance oversight."
>
	{#snippet actions()}
		<div class="flex flex-col sm:flex-row flex-wrap w-full sm:w-auto items-stretch sm:items-center gap-2">
			<Button variant="outline" href="/admin/users" class="w-full sm:w-auto">
				<UsersIcon class="mr-1.5 size-4" />
				Manage Users
			</Button>
			<Button variant="outline" href="/admin/audit-logs" class="w-full sm:w-auto">
				<HistoryIcon class="mr-1.5 size-4" />
				Audit Logs
			</Button>
			<Button href="/admin/grievances" class="w-full sm:w-auto">
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

		<Card class="bg-muted/30 border flex flex-col justify-center p-4">
			<div class="flex items-center gap-3">
				<div class="size-9 rounded-md bg-muted flex items-center justify-center text-foreground">
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

	<!-- 2-Column Overview: Grievances & Live Audit Stream -->
	<div class="grid gap-6 lg:grid-cols-2 mt-8">
		<!-- Recent grievances -->
		<Card>
			<CardHeader class="flex-row items-center justify-between pb-3">
				<div>
					<CardTitle class="text-base">Recent Grievances</CardTitle>
					<CardDescription class="text-xs">Latest student complaints across hostels.</CardDescription>
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
									class="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors"
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

		<!-- Live System Audit Trail -->
		<Card>
			<CardHeader class="flex-row items-center justify-between pb-3">
				<div>
					<CardTitle class="text-base flex items-center gap-2">
						<span>Live Audit Stream</span>
						<span class="size-2 rounded-full bg-foreground animate-pulse"></span>
					</CardTitle>
					<CardDescription class="text-xs">Recent activity from Student & Warden panels.</CardDescription>
				</div>
				<Button variant="ghost" size="sm" href="/admin/audit-logs">
					Full logs
					<ArrowRightIcon class="ml-1 size-4" />
				</Button>
			</CardHeader>
			<CardContent>
				{#if recentAuditLogs.length === 0}
					<EmptyState title="No audit events" description="Audit logs will record automatically as users interact with the system." />
				{:else}
					<ul class="divide-y">
						{#each recentAuditLogs as log (log.id)}
							<li class="py-2.5">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-1.5 flex-wrap">
											{#if log.actorRole === 'student'}
												<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground border border-border">Student</span>
											{:else if log.actorRole === 'warden'}
												<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground border border-foreground/30">Warden</span>
											{:else if log.actorRole === 'admin'}
												<span class="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">Admin</span>
											{:else}
												<span class="rounded bg-transparent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-dashed border-border">System</span>
											{/if}
											<span class="text-xs font-semibold text-foreground truncate">{log.action}</span>
										</div>
										<div class="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
											<span>{log.actorName ?? log.actorRole}</span>
											<span>•</span>
											<span>{formatTimeAgo(log.createdAt)}</span>
											{#if log.targetId}
												<span>•</span>
												<span class="font-mono text-[10px]">{log.targetId}</span>
											{/if}
										</div>
									</div>
									<div class="shrink-0 pt-0.5">
										{#if log.status === 'success'}
											<span class="size-2 rounded-full bg-foreground block" title="Success"></span>
										{:else if log.status === 'warning'}
											<span class="size-2 rounded-full bg-muted-foreground block" title="Warning"></span>
										{:else}
											<span class="size-2 rounded-full border border-foreground bg-transparent block" title="Failure"></span>
										{/if}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</CardContent>
		</Card>
	</div>
{/if}

