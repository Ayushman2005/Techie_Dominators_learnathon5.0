<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import SlaBadge from '$lib/components/app/sla-badge.svelte';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import ListSkeleton from '$lib/components/app/list-skeleton.svelte';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { grievanceService } from '$lib/services';
	import { getSlaStatus } from '$lib/sla';
	import type { Grievance } from '$lib/types';

	let grievances = $state<Grievance[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	async function load() {
		loading = true;
		error = null;
		const result = await grievanceService.listAll();
		if (result.ok) {
			grievances = result.data;
		} else {
			error = result.error;
		}
		loading = false;
	}

	load();
</script>

<svelte:head><title>All grievances · HostelGrievance</title></svelte:head>

<PageHeader title="All grievances" description="Grievances filed by students across the hostel." />

{#if loading}
	<ListSkeleton rows={6} />
{:else if error}
	<ErrorState message={error} onRetry={load} />
{:else if grievances.length === 0}
	<EmptyState title="No grievances" description="When students file grievances, they will show up here." />
{:else}
	<Card>
		<CardContent class="px-0">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>ID</TableHead>
						<TableHead>Student</TableHead>
						<TableHead>Title</TableHead>
						<TableHead>Category</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>SLA</TableHead>
						<TableHead>Created</TableHead>
						<TableHead>Updated</TableHead>
						<TableHead class="text-right"><span class="sr-only">Actions</span></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each grievances as g (g.id)}
						{@const sla = getSlaStatus(g.priority ?? 'medium', g.createdAt, g.status)}
						<TableRow class={sla.overdue ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
							<TableCell class="text-muted-foreground font-mono text-xs">{g.id}</TableCell>
							<TableCell class="whitespace-nowrap">
								<span class="font-medium">{g.student.name}</span>
								<div class="text-muted-foreground text-[11px] flex items-center gap-1 mt-0.5">
									{#if g.student.rollNo}
										<span class="font-mono">Roll: {g.student.rollNo}</span>
										<span>•</span>
									{/if}
									<span>Room: {g.student.room ?? '—'}</span>
								</div>
							</TableCell>
							<TableCell class="max-w-64 truncate font-medium">
								<a href="/warden/grievances/{g.id}" class="hover:underline">{g.title}</a>
							</TableCell>
							<TableCell>{g.category}</TableCell>
							<TableCell><StatusBadge status={g.status} /></TableCell>
							<TableCell>
								<SlaBadge priority={g.priority ?? 'medium'} createdAt={g.createdAt} status={g.status} />
							</TableCell>
							<TableCell class="text-muted-foreground whitespace-nowrap">{formatDate(g.createdAt)}</TableCell>
							<TableCell class="text-muted-foreground whitespace-nowrap">{formatDate(g.updatedAt)}</TableCell>
							<TableCell class="text-right">
								<Button variant="outline" size="sm" href="/warden/grievances/{g.id}">Open</Button>
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</CardContent>
	</Card>
{/if}
