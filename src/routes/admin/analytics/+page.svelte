<script lang="ts">
	import { analyticsService } from '$lib/services';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table/index.js';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import BarChart from '$lib/components/app/bar-chart.svelte';
	import DonutChart from '$lib/components/app/donut-chart.svelte';
	import LineAreaChart from '$lib/components/app/line-area-chart.svelte';
	import type { GrievanceAnalytics } from '$lib/types';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

	// Time range state
	type Range = 7 | 30 | 90 | 0;
	let activeDays = $state<Range>(30);

	let analytics = $state<GrievanceAnalytics | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		const result = await analyticsService.getGrievanceAnalytics(activeDays);
		if (result.ok) {
			analytics = result.data;
		} else {
			error = result.error;
		}
		loading = false;
	}

	$effect(() => {
		// Re-fetch whenever activeDays changes
		activeDays;
		load();
	});

	// ── Chart data derivations ────────────────────────────────────────────────

	const categoryChartData = $derived(
		analytics
			? Object.entries(analytics.byCategory)
					.sort((a, b) => b[1] - a[1])
					.map(([label, value]) => ({ label, value }))
			: []
	);

	const prioritySegments = $derived(
		analytics
			? [
					{ label: 'Urgent', value: analytics.byPriority['urgent'] ?? 0, color: '#ef4444' },
					{ label: 'High', value: analytics.byPriority['high'] ?? 0, color: '#f97316' },
					{ label: 'Medium', value: analytics.byPriority['medium'] ?? 0, color: '#eab308' },
					{ label: 'Low', value: analytics.byPriority['low'] ?? 0, color: '#22c55e' }
			  ]
			: []
	);

	/** Format "YYYY-MM" → "Mon 'YY" e.g. "2025-01" → "Jan '25" */
	function fmtMonth(ym: string): string {
		const [year, month] = ym.split('-');
		const d = new Date(Number(year), Number(month) - 1, 1);
		return d.toLocaleString('en-IN', { month: 'short' }) + " '" + year.slice(2);
	}

	const monthlyChartData = $derived(
		analytics ? analytics.monthlyVolume.map((m) => ({ label: fmtMonth(m.month), value: m.count })) : []
	);

	function fmtHours(h: number | null): string {
		if (h === null) return '—';
		if (h < 1) return '<1h';
		if (h < 24) return `${h}h`;
		const days = Math.floor(h / 24);
		const rem = Math.round(h % 24);
		return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
	}

	const RANGE_LABELS: Record<number, string> = { 7: 'Last 7d', 30: 'Last 30d', 90: 'Last 90d', 0: 'All Time' };
</script>

<svelte:head><title>Analytics · Admin · HostelGrievance</title></svelte:head>

<PageHeader
	title="Analytics Dashboard"
	description="Accurate, real-time insights into grievance trends, resolution performance, and SLA compliance."
>
	{#snippet actions()}
		<div class="flex items-center gap-2">
			<!-- Time Range Filter -->
			<div class="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs">
				{#each ([7, 30, 90, 0] as Range[]) as d}
					<button
						class="px-3 py-1 rounded-md font-medium transition-colors
							{activeDays === d
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground hover:bg-background/60'}"
						onclick={() => (activeDays = d)}
					>
						{RANGE_LABELS[d]}
					</button>
				{/each}
			</div>
			<Button variant="outline" size="sm" onclick={load} disabled={loading}>
				<RefreshCwIcon class="size-3.5 {loading ? 'animate-spin' : ''}" />
			</Button>
		</div>
	{/snippet}
</PageHeader>

{#if error}
	<ErrorState message={error} onRetry={load} />
{:else if loading}
	<!-- Skeleton KPI row -->
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
		{#each [1, 2, 3, 4] as _}
			<Card>
				<CardContent class="p-5 space-y-2">
					<div class="h-3 rounded bg-muted animate-pulse w-24"></div>
					<div class="h-7 rounded bg-muted animate-pulse w-16"></div>
					<div class="h-2.5 rounded bg-muted animate-pulse w-32"></div>
				</CardContent>
			</Card>
		{/each}
	</div>
	<div class="h-64 rounded-xl bg-muted/40 animate-pulse mb-4"></div>
{:else if analytics}
	<!-- ── KPI Summary Row ──────────────────────────────────────────────────── -->
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
		<Card>
			<CardContent class="p-5">
				<div class="flex items-center justify-between mb-1">
					<span class="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Grievances</span>
					<LayersIcon class="size-4 text-muted-foreground" />
				</div>
				<p class="text-3xl font-bold tabular-nums">{analytics.totalGrievances}</p>
				<p class="text-xs text-muted-foreground mt-1">{RANGE_LABELS[activeDays]}</p>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-5">
				<div class="flex items-center justify-between mb-1">
					<span class="text-xs text-muted-foreground font-medium uppercase tracking-wide">Resolution Rate</span>
					<CheckCircle2Icon class="size-4 text-emerald-500" />
				</div>
				<p class="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
					{analytics.resolutionRatePct}%
				</p>
				<p class="text-xs text-muted-foreground mt-1">{analytics.resolved} of {analytics.totalGrievances} resolved</p>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-5">
				<div class="flex items-center justify-between mb-1">
					<span class="text-xs text-muted-foreground font-medium uppercase tracking-wide">Avg. Resolution</span>
					<ClockIcon class="size-4 text-sky-500" />
				</div>
				<p class="text-3xl font-bold tabular-nums text-sky-600 dark:text-sky-400">
					{fmtHours(analytics.avgResolutionHours)}
				</p>
				<p class="text-xs text-muted-foreground mt-1">Time to resolve</p>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-5">
				<div class="flex items-center justify-between mb-1">
					<span class="text-xs text-muted-foreground font-medium uppercase tracking-wide">SLA Overdue</span>
					<AlertTriangleIcon class="size-4 {analytics.overdueCount > 0 ? 'text-red-500' : 'text-muted-foreground'}" />
				</div>
				<p class="text-3xl font-bold tabular-nums {analytics.overdueCount > 0 ? 'text-red-600 dark:text-red-400' : ''}">
					{analytics.overdueCount}
				</p>
				<p class="text-xs text-muted-foreground mt-1">Open past SLA window</p>
			</CardContent>
		</Card>
	</div>

	<!-- ── Charts Row 1: Monthly trend + Priority donut ─────────────────────── -->
	<div class="grid gap-4 lg:grid-cols-3 mb-4">
		<!-- Monthly Volume Trend (spans 2/3) -->
		<Card class="lg:col-span-2">
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-semibold flex items-center gap-2">
					<TrendingUpIcon class="size-4 text-primary" />
					Monthly Volume (Last 6 Months)
				</CardTitle>
				<CardDescription class="text-xs">Total grievances filed per month</CardDescription>
			</CardHeader>
			<CardContent>
				{#if monthlyChartData.length === 0}
					<p class="text-muted-foreground text-sm py-10 text-center">No data for this period.</p>
				{:else}
					<LineAreaChart data={monthlyChartData} height={200} />
				{/if}
			</CardContent>
		</Card>

		<!-- Priority Distribution -->
		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-semibold">Priority Distribution</CardTitle>
				<CardDescription class="text-xs">Breakdown by severity</CardDescription>
			</CardHeader>
			<CardContent>
				{#if analytics.totalGrievances === 0}
					<p class="text-muted-foreground text-sm py-10 text-center">No data.</p>
				{:else}
					<DonutChart segments={prioritySegments} size={140} />
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- ── Charts Row 2: Category bar chart ─────────────────────────────────── -->
	<Card class="mb-4">
		<CardHeader class="pb-2">
			<CardTitle class="text-sm font-semibold">Grievances by Category</CardTitle>
			<CardDescription class="text-xs">Which category receives the most complaints</CardDescription>
		</CardHeader>
		<CardContent>
			{#if categoryChartData.length === 0}
				<p class="text-muted-foreground text-sm py-10 text-center">No data for this period.</p>
			{:else}
				<BarChart data={categoryChartData} height={220} />
			{/if}
		</CardContent>
	</Card>

	<!-- ── Warden Performance Table ──────────────────────────────────────────── -->
	<Card>
		<CardHeader class="pb-2">
			<CardTitle class="text-sm font-semibold">Warden Performance</CardTitle>
			<CardDescription class="text-xs">
				Resolution rate and average time per assigned warden. Data is accurate and sourced directly from the database.
			</CardDescription>
		</CardHeader>
		<CardContent class="px-0">
			{#if analytics.wardenPerformance.length === 0}
				<div class="py-10 text-center text-muted-foreground text-sm">
					No warden data available for this period. Ensure wardens are assigned to students.
				</div>
			{:else}
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Warden</TableHead>
							<TableHead class="text-right">Total</TableHead>
							<TableHead class="text-right">Open</TableHead>
							<TableHead class="text-right">In Progress</TableHead>
							<TableHead class="text-right">Resolved</TableHead>
							<TableHead class="text-right">Rate</TableHead>
							<TableHead class="text-right">Avg Time</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each analytics.wardenPerformance as w (w.wardenId)}
							<TableRow>
								<TableCell>
									<span class="font-medium text-sm">{w.wardenName}</span>
									{#if w.wardenEmpId}
										<div class="text-xs text-muted-foreground font-mono">EMP: {w.wardenEmpId}</div>
									{/if}
								</TableCell>
								<TableCell class="text-right tabular-nums font-semibold">{w.totalGrievances}</TableCell>
								<TableCell class="text-right tabular-nums text-amber-600">{w.open}</TableCell>
								<TableCell class="text-right tabular-nums text-sky-600">{w.inProgress}</TableCell>
								<TableCell class="text-right tabular-nums text-emerald-600">{w.resolved}</TableCell>
								<TableCell class="text-right">
									<span
										class="font-semibold tabular-nums
											{w.resolutionRatePct >= 70
												? 'text-emerald-600 dark:text-emerald-400'
												: w.resolutionRatePct >= 40
												? 'text-amber-600 dark:text-amber-400'
												: 'text-red-600 dark:text-red-400'}"
									>
										{w.resolutionRatePct}%
									</span>
								</TableCell>
								<TableCell class="text-right text-muted-foreground tabular-nums">
									{fmtHours(w.avgResolutionHours)}
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			{/if}
		</CardContent>
	</Card>
{/if}
