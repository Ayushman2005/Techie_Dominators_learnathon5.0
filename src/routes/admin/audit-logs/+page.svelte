<script lang="ts">	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import ListSkeleton from '$lib/components/app/list-skeleton.svelte';
	import { auditLogService } from '$lib/services';
	import type { AuditLog, AuditLogRole, AuditLogStats, AuditLogStatus } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import SearchIcon from '@lucide/svelte/icons/search';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import UserCheckIcon from '@lucide/svelte/icons/user-check';
	import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	let logs = $state<AuditLog[]>([]);
	let stats = $state<AuditLogStats | null>(null);
	let loading = $state(true);
	let statsLoading = $state(true);
	let error = $state<string | null>(null);

	let activeRole = $state<AuditLogRole | 'all'>('all');
	let activeStatus = $state<AuditLogStatus | 'all'>('all');
	let searchQuery = $state('');
	let currentPage = $state(1);
	let pageSize = $state(20);
	let totalItems = $state(0);
	let totalPages = $state(1);

	let autoRefresh = $state(false);
	let refreshTimer: ReturnType<typeof setInterval> | null = null;

	let inspectorOpen = $state(false);
	let selectedLog = $state<AuditLog | null>(null);

	function formatDate(iso: string): { relative: string; full: string } {
		const d = new Date(iso);
		const full = d.toLocaleString('en-IN', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});

		const now = Date.now();
		const diffSec = Math.floor((now - d.getTime()) / 1000);

		let relative = '';
		if (diffSec < 60) relative = `${Math.max(1, diffSec)}s ago`;
		else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)}m ago`;
		else if (diffSec < 86400) relative = `${Math.floor(diffSec / 3600)}h ago`;
		else relative = `${Math.floor(diffSec / 86400)}d ago`;

		return { relative, full };
	}

	async function loadStats() {
		statsLoading = true;
		const res = await auditLogService.getStats();
		if (res.ok) {
			stats = res.data;
		}
		statsLoading = false;
	}

	async function loadLogs() {
		loading = true;
		error = null;

		const res = await auditLogService.list({
			role: activeRole,
			status: activeStatus,
			search: searchQuery.trim() || undefined,
			page: currentPage,
			limit: pageSize
		});

		if (res.ok) {
			logs = res.data.data;
			totalItems = res.data.total;
			currentPage = res.data.page;
			totalPages = res.data.totalPages;
		} else {
			error = res.error;
		}

		loading = false;
	}

	function handleRoleChange(role: AuditLogRole | 'all') {
		activeRole = role;
		currentPage = 1;
		loadLogs();
	}

	function handleStatusChange(status: AuditLogStatus | 'all') {
		activeStatus = status;
		currentPage = 1;
		loadLogs();
	}

	let searchDebounce: ReturnType<typeof setTimeout> | null = null;
	function handleSearchInput() {
		if (searchDebounce) clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			currentPage = 1;
			loadLogs();
		}, 300);
	}

	function toggleAutoRefresh() {
		autoRefresh = !autoRefresh;
		if (autoRefresh) {
			toast.info('Live audit stream enabled (polling every 5s)');
			refreshTimer = setInterval(() => {
				loadLogs();
				loadStats();
			}, 5000);
		} else {
			if (refreshTimer) clearInterval(refreshTimer);
			refreshTimer = null;
			toast.info('Live auto-refresh disabled');
		}
	}

	async function exportCsv() {
		toast.loading('Generating CSV audit log export...');
		const res = await auditLogService.exportLogs('csv', {
			role: activeRole,
			status: activeStatus,
			search: searchQuery.trim() || undefined
		});

		if (res.ok && typeof res.data === 'string') {
			const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success('Audit logs exported to CSV successfully.');
		} else {
			toast.error('Could not export audit logs.');
		}
	}

	async function exportJson() {
		toast.loading('Generating JSON audit log export...');
		const res = await auditLogService.exportLogs('json', {
			role: activeRole,
			status: activeStatus,
			search: searchQuery.trim() || undefined
		});

		if (res.ok && Array.isArray(res.data)) {
			const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success('Audit logs exported to JSON successfully.');
		} else {
			toast.error('Could not export audit logs.');
		}
	}

	function inspect(log: AuditLog) {
		selectedLog = log;
		inspectorOpen = true;
	}

	function copyJson() {
		if (!selectedLog) return;
		navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
		toast.success('Audit event JSON copied to clipboard.');
	}

	loadStats();
	loadLogs();

	$effect(() => {
		return () => {
			if (refreshTimer) clearInterval(refreshTimer);
		};
	});
</script>

<svelte:head>
	<title>Audit Logs · HostelGrievance Admin</title>
</svelte:head>

<PageHeader
	title="System Audit Logs"
	description="Comprehensive, tamper-resistant record of all student and warden activity across the platform."
>
	{#snippet actions()}
		<div class="flex flex-wrap items-center gap-2">
			<Button
				variant={autoRefresh ? 'default' : 'outline'}
				size="sm"
				onclick={toggleAutoRefresh}
			>
				<RefreshCwIcon class="mr-1.5 size-3.5 {autoRefresh ? 'animate-spin' : ''}" />
				{autoRefresh ? 'Live Stream Active' : 'Live Stream Off'}
			</Button>

			<Button variant="outline" size="sm" onclick={() => { loadLogs(); loadStats(); }}>
				<RefreshCwIcon class="mr-1.5 size-3.5" />
				Refresh
			</Button>

			<Button variant="outline" size="sm" onclick={exportCsv}>
				<DownloadIcon class="mr-1.5 size-3.5" />
				Export CSV
			</Button>

			<Button variant="outline" size="sm" onclick={exportJson}>
				<FileTextIcon class="mr-1.5 size-3.5" />
				Export JSON
			</Button>
		</div>
	{/snippet}
</PageHeader>

<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
	<Card class="bg-card shadow-xs border">
		<CardHeader class="pb-2 flex flex-row items-center justify-between">
			<div>
				<CardDescription class="text-xs">Total Logged Events</CardDescription>
				<CardTitle class="text-2xl font-bold text-foreground">{stats?.totalEvents ?? 0}</CardTitle>
			</div>
			<div class="size-9 rounded-lg bg-muted flex items-center justify-center text-foreground">
				<ActivityIcon class="size-5" />
			</div>
		</CardHeader>
		<CardContent>
			<p class="text-xs text-muted-foreground">{stats?.todayEvents ?? 0} events recorded today</p>
		</CardContent>
	</Card>

	<Card class="bg-card shadow-xs border">
		<CardHeader class="pb-2 flex flex-row items-center justify-between">
			<div>
				<CardDescription class="text-xs">Student Panel Actions</CardDescription>
				<CardTitle class="text-2xl font-bold text-foreground">{stats?.studentEvents ?? 0}</CardTitle>
			</div>
			<div class="size-9 rounded-lg bg-muted flex items-center justify-center text-foreground">
				<GraduationCapIcon class="size-5" />
			</div>
		</CardHeader>
		<CardContent>
			<p class="text-xs text-muted-foreground">Complaints filed, comments, attachments</p>
		</CardContent>
	</Card>

	<Card class="bg-card shadow-xs border">
		<CardHeader class="pb-2 flex flex-row items-center justify-between">
			<div>
				<CardDescription class="text-xs">Warden Panel Actions</CardDescription>
				<CardTitle class="text-2xl font-bold text-foreground">{stats?.wardenEvents ?? 0}</CardTitle>
			</div>
			<div class="size-9 rounded-lg bg-muted flex items-center justify-center text-foreground">
				<UserCheckIcon class="size-5" />
			</div>
		</CardHeader>
		<CardContent>
			<p class="text-xs text-muted-foreground">Status transitions, remarks, student setup</p>
		</CardContent>
	</Card>

	<Card class="bg-card shadow-xs border">
		<CardHeader class="pb-2 flex flex-row items-center justify-between">
			<div>
				<CardDescription class="text-xs">Security & Warnings</CardDescription>
				<CardTitle class="text-2xl font-bold text-foreground">{stats?.warningEvents ?? 0}</CardTitle>
			</div>
			<div class="size-9 rounded-lg bg-muted flex items-center justify-center text-foreground">
				<ShieldAlertIcon class="size-5" />
			</div>
		</CardHeader>
		<CardContent>
			<p class="text-xs text-muted-foreground">Failed sign-ins, unauthorized blocks, deletions</p>
		</CardContent>
	</Card>
</div>

<div class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
	<div class="relative w-full max-w-sm">
		<SearchIcon class="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
		<Input
			type="search"
			placeholder="Search actor, action, grievance ID, details..."
			class="pl-8 text-sm"
			bind:value={searchQuery}
			oninput={handleSearchInput}
		/>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<div class="bg-muted inline-flex rounded-lg p-1 text-xs border">
			<button
				class="rounded-md px-2.5 py-1 font-medium transition-colors {activeRole === 'all'
					? 'bg-foreground text-background shadow-xs'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => handleRoleChange('all')}
			>
				All Roles
			</button>
			<button
				class="rounded-md px-2.5 py-1 font-medium transition-colors {activeRole === 'student'
					? 'bg-foreground text-background shadow-xs'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => handleRoleChange('student')}
			>
				Students
			</button>
			<button
				class="rounded-md px-2.5 py-1 font-medium transition-colors {activeRole === 'warden'
					? 'bg-foreground text-background shadow-xs'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => handleRoleChange('warden')}
			>
				Wardens
			</button>
			<button
				class="rounded-md px-2.5 py-1 font-medium transition-colors {activeRole === 'admin'
					? 'bg-foreground text-background shadow-xs'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => handleRoleChange('admin')}
			>
				Admin
			</button>
			<button
				class="rounded-md px-2.5 py-1 font-medium transition-colors {activeRole === 'system'
					? 'bg-foreground text-background shadow-xs'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => handleRoleChange('system')}
			>
				System
			</button>
		</div>

		<select
			class="flex h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			value={activeStatus}
			onchange={(e) => handleStatusChange(e.currentTarget.value as AuditLogStatus | 'all')}
		>
			<option value="all">All Statuses</option>
			<option value="success">Success</option>
			<option value="warning">Warning</option>
			<option value="failure">Failure</option>
			<option value="info">Info</option>
		</select>
	</div>
</div>

<Card>
	<CardContent class="p-0">
		{#if loading && logs.length === 0}
			<div class="p-6">
				<ListSkeleton rows={8} />
			</div>
		{:else if error}
			<div class="p-6">
				<ErrorState message={error} onRetry={loadLogs} />
			</div>
		{:else if logs.length === 0}
			<div class="p-8">
				<EmptyState
					title="No audit logs found"
					description="No events match your current filter and search query."
				/>
			</div>
		{:else}
			<Table>
				<TableHeader>
					<TableRow class="bg-muted/40">
						<TableHead class="w-32">Timestamp</TableHead>
						<TableHead class="w-48">Actor</TableHead>
						<TableHead>Action / Activity</TableHead>
						<TableHead class="w-36">Target</TableHead>
						<TableHead class="w-24">Status</TableHead>
						<TableHead class="w-28 text-right">Details</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each logs as log (log.id)}
						{@const time = formatDate(log.createdAt)}
						<TableRow class="hover:bg-muted/40 transition-colors">
							<TableCell class="font-mono text-xs text-muted-foreground whitespace-nowrap">
								<div class="font-medium text-foreground">{time.relative}</div>
								<div class="text-[10px] text-muted-foreground" title={time.full}>{time.full.split(',')[1]}</div>
							</TableCell>

							<TableCell>
								<div class="flex items-center gap-2">
									{#if log.actorRole === 'student'}
										<span class="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground border border-border">
											Student
										</span>
									{:else if log.actorRole === 'warden'}
										<span class="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground border border-foreground/30">
											Warden
										</span>
									{:else if log.actorRole === 'admin'}
										<span class="inline-flex items-center rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-bold text-background">
											Admin
										</span>
									{:else}
										<span class="inline-flex items-center rounded-md bg-transparent px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground border border-dashed border-border">
											System
										</span>
									{/if}
									<div class="min-w-0 truncate">
										<p class="text-xs font-medium truncate">{log.actorName ?? log.actorRole}</p>
										{#if log.actorEmail}
											<p class="text-[10px] text-muted-foreground truncate">{log.actorEmail}</p>
										{/if}
									</div>
								</div>
							</TableCell>

							<TableCell>
								<div class="space-y-0.5">
									<p class="text-xs font-semibold text-foreground">{log.action}</p>
									<div class="flex items-center gap-2 text-[11px] text-muted-foreground">
										<span class="font-mono text-[10px] text-muted-foreground bg-muted px-1 py-0.2 rounded border border-border">
											{log.eventType}
										</span>
										{#if log.ipAddress}
											<span>IP: {log.ipAddress}</span>
										{/if}
									</div>
								</div>
							</TableCell>

							<TableCell>
								{#if log.targetId}
									{#if log.targetType === 'grievance' || log.targetId.startsWith('GRV-')}
										<a
											href="/admin/grievances/{log.targetId}"
											class="inline-flex items-center gap-1 font-mono text-xs text-foreground font-medium hover:underline"
										>
											{log.targetId}
											<ExternalLinkIcon class="size-3" />
										</a>
									{:else if log.targetType === 'user' || log.targetId.startsWith('stu-') || log.targetId.startsWith('war-') || log.targetId.startsWith('adm-')}
										<a
											href="/admin/users"
											class="inline-flex items-center gap-1 font-mono text-xs text-foreground font-medium hover:underline"
										>
											{log.targetId}
											<ExternalLinkIcon class="size-3" />
										</a>
									{:else}
										<span class="font-mono text-xs text-muted-foreground">{log.targetId}</span>
									{/if}
								{:else}
									<span class="text-xs text-muted-foreground">—</span>
								{/if}
							</TableCell>

							<TableCell>
								{#if log.status === 'success'}
									<span class="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground border border-border">
										Success
									</span>
								{:else if log.status === 'warning'}
									<span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground border border-foreground/40">
										Warning
									</span>
								{:else if log.status === 'failure'}
									<span class="inline-flex items-center rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background border border-foreground">
										Failure
									</span>
								{:else}
									<span class="inline-flex items-center rounded-full bg-transparent px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-dashed border-border">
										Info
									</span>
								{/if}
							</TableCell>

							<TableCell class="text-right">
								<Button
									variant="ghost"
									size="sm"
									class="h-7 px-2 text-xs"
									onclick={() => inspect(log)}
								>
									<EyeIcon class="mr-1 size-3.5" />
									Inspect
								</Button>
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		{/if}
	</CardContent>
</Card>

{#if totalPages > 1}
	<div class="mt-4 flex items-center justify-between">
		<p class="text-xs text-muted-foreground">
			Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} events
		</p>
		<div class="flex items-center gap-1.5">
			<Button
				variant="outline"
				size="sm"
				disabled={currentPage <= 1}
				onclick={() => { currentPage -= 1; loadLogs(); }}
			>
				<ChevronLeftIcon class="size-4 mr-1" />
				Previous
			</Button>
			<span class="text-xs font-medium px-2">Page {currentPage} of {totalPages}</span>
			<Button
				variant="outline"
				size="sm"
				disabled={currentPage >= totalPages}
				onclick={() => { currentPage += 1; loadLogs(); }}
			>
				Next
				<ChevronRightIcon class="size-4 ml-1" />
			</Button>
		</div>
	</div>
{/if}

<Dialog.Root bind:open={inspectorOpen}>
	<Dialog.Content class="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title class="flex items-center justify-between">
				<span>Audit Event Inspector</span>
				{#if selectedLog}
					<span class="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
						{selectedLog.id}
					</span>
				{/if}
			</Dialog.Title>
			<Dialog.Description>
				Deep technical metadata for security, compliance, and dispute resolution.
			</Dialog.Description>
		</Dialog.Header>

		{#if selectedLog}
			<div class="space-y-4 py-2">
				<div class="grid grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg text-xs">
					<div>
						<span class="text-muted-foreground block text-[11px]">Action</span>
						<span class="font-semibold text-foreground">{selectedLog.action}</span>
					</div>
					<div>
						<span class="text-muted-foreground block text-[11px]">Event Type</span>
						<span class="font-mono text-foreground">{selectedLog.eventType}</span>
					</div>
					<div>
						<span class="text-muted-foreground block text-[11px]">Actor</span>
						<span class="text-foreground">{selectedLog.actorName ?? 'System'} ({selectedLog.actorRole})</span>
					</div>
					<div>
						<span class="text-muted-foreground block text-[11px]">Actor Email / ID</span>
						<span class="font-mono text-foreground">{selectedLog.actorEmail ?? selectedLog.actorId ?? 'N/A'}</span>
					</div>
					<div>
						<span class="text-muted-foreground block text-[11px]">Timestamp</span>
						<span class="text-foreground">{formatDate(selectedLog.createdAt).full}</span>
					</div>
					<div>
						<span class="text-muted-foreground block text-[11px]">Origin IP</span>
						<span class="font-mono text-foreground">{selectedLog.ipAddress ?? '127.0.0.1'}</span>
					</div>
				</div>

				<div>
					<div class="flex items-center justify-between mb-1.5">
						<span class="text-xs font-semibold text-foreground">Payload & Context Details</span>
						<Button variant="ghost" size="sm" class="h-6 text-xs" onclick={copyJson}>
							<CopyIcon class="mr-1 size-3" />
							Copy JSON
						</Button>
					</div>
					<pre class="bg-zinc-950 text-zinc-100 p-3.5 rounded-lg text-xs font-mono overflow-x-auto border border-zinc-800">
{JSON.stringify({
  id: selectedLog.id,
  eventType: selectedLog.eventType,
  action: selectedLog.action,
  actor: {
    id: selectedLog.actorId,
    name: selectedLog.actorName,
    email: selectedLog.actorEmail,
    role: selectedLog.actorRole
  },
  target: {
    id: selectedLog.targetId,
    type: selectedLog.targetType
  },
  ipAddress: selectedLog.ipAddress,
  status: selectedLog.status,
  createdAt: selectedLog.createdAt,
  details: selectedLog.details
}, null, 2)}
					</pre>
				</div>
			</div>
		{/if}

		<Dialog.Footer class="pt-2">
			<Button variant="outline" onclick={() => (inspectorOpen = false)}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
