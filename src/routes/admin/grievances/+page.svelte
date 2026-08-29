<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import SlaBadge from '$lib/components/app/sla-badge.svelte';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import ListSkeleton from '$lib/components/app/list-skeleton.svelte';
	import { grievanceService, hostelService } from '$lib/services';
	import { getSlaStatus } from '$lib/sla';
	import type { Grievance, GrievanceStatus, Hostel } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import SearchIcon from '@lucide/svelte/icons/search';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import FileTextIcon from '@lucide/svelte/icons/file-text';

	let grievances = $state<Grievance[]>([]);
	let hostels = $state<Hostel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let activeStatus = $state<'all' | GrievanceStatus>('all');
	let searchQuery = $state('');

	let deleteDialogOpen = $state(false);
	let selectedGrievance = $state<Grievance | null>(null);
	let deleting = $state(false);

	const filteredGrievances = $derived(
		grievances.filter((g) => {
			if (activeStatus !== 'all' && g.status !== activeStatus) return false;
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				const matchTitle = g.title.toLowerCase().includes(q);
				const matchStudent = g.student.name.toLowerCase().includes(q);
				const matchCategory = g.category.toLowerCase().includes(q);
				const matchId = g.id.toLowerCase().includes(q);
				const matchRoom = g.student.room?.toLowerCase().includes(q);
				return matchTitle || matchStudent || matchCategory || matchId || matchRoom;
			}
			return true;
		})
	);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function getHostelName(hostelId?: string | null): string {
		if (!hostelId) return '';
		return hostels.find((h) => h.id === hostelId)?.name || 'Unknown Hostel';
	}

	async function loadGrievances() {
		loading = true;
		error = null;
		const [grievancesRes, hostelsRes] = await Promise.all([
			grievanceService.listAll(),
			hostelService.list()
		]);
		if (grievancesRes.ok) {
			grievances = grievancesRes.data;
		} else {
			error = grievancesRes.error;
		}
		if (hostelsRes.ok) {
			hostels = hostelsRes.data;
		}
		loading = false;
	}

	function confirmDelete(g: Grievance) {
		selectedGrievance = g;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!selectedGrievance) return;
		deleting = true;
		const result = await grievanceService.delete(selectedGrievance.id);
		deleting = false;

		if (result.ok) {
			toast.success(`Grievance ${selectedGrievance.id} permanently deleted.`);
			deleteDialogOpen = false;
			await loadGrievances();
		} else {
			toast.error('Could not delete grievance.', { description: result.error });
		}
	}

	function exportCsv() {
		if (filteredGrievances.length === 0) {
			toast.info('No grievances to export.');
			return;
		}

		const headers = ['ID', 'Student Name', 'Roll No', 'Hostel', 'Room', 'Email', 'Title', 'Category', 'Status', 'Date Filed'];
		
		const rows = filteredGrievances.map((g) => {
			return [
				g.id,
				`"${g.student.name.replace(/"/g, '""')}"`,
				g.student.rollNo || '',
				`"${getHostelName(g.student.hostelId).replace(/"/g, '""')}"`,
				g.student.room || '',
				g.student.email,
				`"${g.title.replace(/"/g, '""')}"`,
				g.category,
				g.status,
				new Date(g.createdAt).toISOString()
			].join(',');
		});

		const csvContent = [headers.join(','), ...rows].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `grievances_export_${new Date().toISOString().slice(0, 10)}.csv`;
		link.click();
		URL.revokeObjectURL(url);
		
		toast.success('Grievances exported to CSV successfully.');
	}

	function exportJson() {
		if (filteredGrievances.length === 0) {
			toast.info('No grievances to export.');
			return;
		}

		const jsonStr = JSON.stringify(filteredGrievances, null, 2);
		const blob = new Blob([jsonStr], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `grievances_export_${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);

		toast.success('Grievances exported to JSON successfully.');
	}

	loadGrievances();
</script>

<svelte:head><title>All Grievances · HostelGrievance Admin</title></svelte:head>

<PageHeader
	title="All Grievances"
	description="Complete overview and administration of student complaints and requests."
>
	{#snippet actions()}
		<div class="flex flex-col sm:flex-row flex-wrap w-full sm:w-auto items-stretch sm:items-center gap-2">
			<Button variant="outline" size="sm" onclick={exportCsv} class="w-full sm:w-auto">
				<DownloadIcon class="mr-1.5 size-3.5" />
				Export CSV
			</Button>

			<Button variant="outline" size="sm" onclick={exportJson} class="w-full sm:w-auto">
				<FileTextIcon class="mr-1.5 size-3.5" />
				Export JSON
			</Button>
		</div>
	{/snippet}
</PageHeader>

<!-- Filter controls -->
<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<div class="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
		<Button
			variant={activeStatus === 'all' ? 'secondary' : 'ghost'}
			size="sm"
			class="text-xs h-7 px-3"
			onclick={() => (activeStatus = 'all')}
		>
			All ({grievances.length})
		</Button>
		<Button
			variant={activeStatus === 'Open' ? 'secondary' : 'ghost'}
			size="sm"
			class="text-xs h-7 px-3"
			onclick={() => (activeStatus = 'Open')}
		>
			Open ({grievances.filter((g) => g.status === 'Open').length})
		</Button>
		<Button
			variant={activeStatus === 'In Progress' ? 'secondary' : 'ghost'}
			size="sm"
			class="text-xs h-7 px-3"
			onclick={() => (activeStatus = 'In Progress')}
		>
			In Progress ({grievances.filter((g) => g.status === 'In Progress').length})
		</Button>
		<Button
			variant={activeStatus === 'Resolved' ? 'secondary' : 'ghost'}
			size="sm"
			class="text-xs h-7 px-3"
			onclick={() => (activeStatus = 'Resolved')}
		>
			Resolved ({grievances.filter((g) => g.status === 'Resolved').length})
		</Button>
	</div>

	<div class="relative w-full sm:w-64">
		<SearchIcon class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
		<Input
			type="search"
			placeholder="Search title, student, room…"
			class="pl-9 h-9 text-xs"
			bind:value={searchQuery}
		/>
	</div>
</div>

{#if loading}
	<ListSkeleton rows={6} />
{:else if error}
	<ErrorState message={error} onRetry={loadGrievances} />
{:else if filteredGrievances.length === 0}
	<EmptyState
		title="No grievances found"
		description={searchQuery ? "No grievances match your search criteria." : "No grievances under this status filter."}
	/>
{:else}
	<Card>
		<CardContent class="px-0">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead class="w-24">ID</TableHead>
						<TableHead>Student / Room</TableHead>
						<TableHead>Title</TableHead>
						<TableHead>Category</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>SLA</TableHead>
						<TableHead>Date Filed</TableHead>
						<TableHead class="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each filteredGrievances as g (g.id)}
						{@const sla = getSlaStatus(g.priority ?? 'medium', g.createdAt, g.status)}
						<TableRow class={sla.overdue ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
							<TableCell class="font-mono text-xs text-muted-foreground">{g.id}</TableCell>
							<TableCell class="whitespace-nowrap">
								<span class="font-medium text-sm block">{g.student.name}</span>
								<div class="text-muted-foreground text-xs mt-0.5 flex flex-col gap-0.5">
									<span class="flex items-center gap-1">
										{#if g.student.rollNo}
											<span class="font-mono">Roll: {g.student.rollNo}</span>
											<span>·</span>
										{/if}
										{#if getHostelName(g.student.hostelId)}
											<span class="text-amber-600 font-medium">{getHostelName(g.student.hostelId)}</span>
											<span>·</span>
										{/if}
										<span>{g.student.room ?? 'No room'}</span>
									</span>
									<span class="font-mono text-[10px]">{g.student.email}</span>
								</div>
							</TableCell>
							<TableCell class="max-w-xs truncate font-medium">
								<a href="/admin/grievances/{g.id}" class="hover:underline hover:text-primary transition-colors">
									{g.title}
								</a>
							</TableCell>
							<TableCell class="text-xs">{g.category}</TableCell>
							<TableCell><StatusBadge status={g.status} /></TableCell>
							<TableCell>
								<SlaBadge priority={g.priority ?? 'medium'} createdAt={g.createdAt} status={g.status} />
							</TableCell>
							<TableCell class="text-muted-foreground text-xs whitespace-nowrap">{formatDate(g.createdAt)}</TableCell>
							<TableCell class="text-right whitespace-nowrap">
								<div class="flex items-center justify-end gap-1">
									<Button variant="outline" size="sm" href="/admin/grievances/{g.id}" class="h-8 gap-1 text-xs">
										Open
										<ExternalLinkIcon class="size-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon-sm"
										class="size-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
										onclick={() => confirmDelete(g)}
										title="Delete grievance"
									>
										<Trash2Icon class="size-3.5" />
									</Button>
								</div>
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</CardContent>
	</Card>
{/if}

<!-- DELETE GRIEVANCE CONFIRMATION DIALOG -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete Grievance</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to permanently delete grievance <strong>{selectedGrievance?.id}</strong>: "{selectedGrievance?.title}"? All comments and attachments will also be removed.
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
