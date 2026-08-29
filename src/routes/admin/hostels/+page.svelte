<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import BuildingIcon from '@lucide/svelte/icons/building';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { hostelService } from '$lib/services';
	import type { Hostel } from '$lib/types';

	let hostels = $state<Hostel[]>([]);
	let loading = $state(true);
	let formSubmitting = $state(false);

	let name = $state('');

	async function loadHostels() {
		loading = true;
		const result = await hostelService.list();
		if (result.ok) {
			hostels = result.data;
		} else {
			toast.error('Failed to load hostels', { description: result.error });
		}
		loading = false;
	}

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) {
			toast.error('Hostel name is required.');
			return;
		}
		formSubmitting = true;
		const result = await hostelService.create(name.trim());
		if (result.ok) {
			toast.success('Hostel created successfully.');
			name = '';
			await loadHostels();
		} else {
			toast.error('Could not create hostel', { description: result.error });
		}
		formSubmitting = false;
	}

	async function handleDelete(id: string) {
		if (!confirm('Are you sure you want to delete this hostel? This will affect users and grievances associated with it.')) return;
		const result = await hostelService.delete(id);
		if (result.ok) {
			toast.success('Hostel deleted successfully.');
			await loadHostels();
		} else {
			toast.error('Could not delete hostel', { description: result.error });
		}
	}

	onMount(() => {
		loadHostels();
	});
</script>

<svelte:head>
	<title>Manage Hostels - Admin</title>
</svelte:head>

<div class="space-y-6">
	<PageHeader
		title="Hostel Management"
		description="Create and manage hostels within the system."
	/>

	<div class="grid gap-6 md:grid-cols-3">
		<div class="md:col-span-1">
			<Card>
				<CardHeader>
					<CardTitle>Add New Hostel</CardTitle>
					<CardDescription>Create a new hostel to assign students and wardens.</CardDescription>
				</CardHeader>
				<CardContent>
					<form onsubmit={handleCreate} class="space-y-4">
						<div class="space-y-2">
							<Label for="name">Hostel Name</Label>
							<Input
								id="name"
								bind:value={name}
								placeholder="e.g. Boys Hostel A"
								disabled={formSubmitting}
							/>
						</div>
						<Button type="submit" disabled={formSubmitting} class="w-full">
							{formSubmitting ? 'Creating...' : 'Create Hostel'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>

		<div class="md:col-span-2 space-y-4">
			{#if loading}
				<div class="space-y-4">
					{#each Array(3) as _}
						<div class="h-24 w-full animate-pulse rounded-lg bg-muted"></div>
					{/each}
				</div>
			{:else if hostels.length === 0}
				<EmptyState
					title="No Hostels Found"
					description="There are no hostels in the system yet. Add the first one using the form."
				/>
			{:else}
				<div class="grid gap-4">
					{#each hostels as hostel}
						<Card>
							<CardContent class="flex items-center justify-between p-6">
								<div>
									<h3 class="font-semibold">{hostel.name}</h3>
									<p class="text-sm text-muted-foreground mt-1 text-xs">
										ID: {hostel.id}
										{#if hostel.createdAt}
											• Created: {new Date(hostel.createdAt).toLocaleDateString()}
										{/if}
									</p>
								</div>
								<Button
									variant="ghost"
									size="icon"
									class="text-destructive hover:bg-destructive/10 hover:text-destructive"
									onclick={() => handleDelete(hostel.id)}
									title="Delete Hostel"
								>
									<Trash2Icon class="h-4 w-4" />
								</Button>
							</CardContent>
						</Card>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
