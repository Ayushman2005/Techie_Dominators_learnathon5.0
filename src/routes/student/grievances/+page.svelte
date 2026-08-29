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
	import PageHeader from '$lib/components/app/page-header.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import ListSkeleton from '$lib/components/app/list-skeleton.svelte';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { grievanceService } from '$lib/services';
	import { getSession } from '$lib/stores/auth.svelte';
	import { GRIEVANCE_CATEGORIES, type Grievance, type GrievanceCategory, type GrievanceStatus } from '$lib/types';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let grievances = $state<Grievance[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filters
	let activeStatus = $state<'all' | GrievanceStatus>('all');
	let activeCategory = $state<'all' | GrievanceCategory>('all');

	const filteredGrievances = $derived(
		grievances
			.filter((g) => activeStatus === 'all' || g.status === activeStatus)
			.filter((g) => activeCategory === 'all' || g.category === activeCategory)
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
	);

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
		const result = await grievanceService.listForStudent(uid);
		if (result.ok) {
			grievances = result.data;
		} else {
			error = result.error;
		}
		loading = false;
	}

	load();
</script>

<svelte:head><title>My grievances · HostelGrievance</title></svelte:head>

<PageHeader title="My grievances" description="All grievances you have filed.">
	{#snippet actions()}
		<Button href="/student/grievances/new">
			<PlusIcon class="size-4" />
			New grievance
		</Button>
	{/snippet}
</PageHeader>

{#if loading}
	<ListSkeleton rows={5} />
{:else if error}
	<ErrorState message={error} onRetry={load} />
{:else if grievances.length === 0}
	<EmptyState
		title="No grievances filed"
		description="You have not filed any grievances yet. Use the button above to create your first one."
	/>
{:else}
	<!-- Filter controls -->
	<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border overflow-x-auto whitespace-nowrap">
			<Button
				variant={activeStatus === 'all' ? 'secondary' : 'ghost'}
				size="sm"
				class="text-xs h-7 px-3"
				onclick={() => (activeStatus = 'all')}
			>
				All
			</Button>
			<Button
				variant={activeStatus === 'Open' ? 'secondary' : 'ghost'}
				size="sm"
				class="text-xs h-7 px-3"
				onclick={() => (activeStatus = 'Open')}
			>
				Open
			</Button>
			<Button
				variant={activeStatus === 'In Progress' ? 'secondary' : 'ghost'}
				size="sm"
				class="text-xs h-7 px-3"
				onclick={() => (activeStatus = 'In Progress')}
			>
				In Progress
			</Button>
			<Button
				variant={activeStatus === 'Resolved' ? 'secondary' : 'ghost'}
				size="sm"
				class="text-xs h-7 px-3"
				onclick={() => (activeStatus = 'Resolved')}
			>
				Resolved
			</Button>
		</div>

		<div class="flex items-center gap-2">
			<select
				class="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				bind:value={activeCategory}
			>
				<option value="all">All Categories</option>
				{#each GRIEVANCE_CATEGORIES as cat}
					<option value={cat}>{cat}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if filteredGrievances.length === 0}
		<EmptyState
			title="No matching grievances"
			description="No grievances match your current filters. Try changing them."
		/>
	{:else}
		<Card>
		<CardContent class="px-0">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>ID</TableHead>
						<TableHead>Title</TableHead>
						<TableHead>Category</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Created</TableHead>
						<TableHead>Last updated</TableHead>
						<TableHead class="text-right"><span class="sr-only">Actions</span></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each filteredGrievances as g (g.id)}
						<TableRow>
							<TableCell class="text-muted-foreground font-mono text-xs">{g.id}</TableCell>
							<TableCell class="max-w-64 truncate font-medium">
								<a href="/student/grievances/{g.id}" class="hover:underline">{g.title}</a>
							</TableCell>
							<TableCell>{g.category}</TableCell>
							<TableCell><StatusBadge status={g.status} /></TableCell>
							<TableCell class="text-muted-foreground whitespace-nowrap">{formatDate(g.createdAt)}</TableCell>
							<TableCell class="text-muted-foreground whitespace-nowrap">{formatDate(g.updatedAt)}</TableCell>
							<TableCell class="text-right">
								<Button variant="outline" size="sm" href="/student/grievances/{g.id}">Open</Button>
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</CardContent>
	</Card>
	{/if}
{/if}
