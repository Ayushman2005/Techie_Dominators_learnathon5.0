<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
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
	import PageHeader from '$lib/components/app/page-header.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import ListSkeleton from '$lib/components/app/list-skeleton.svelte';
	import { userService } from '$lib/services';
	import type { CreateUserInput, UpdateUserInput, User } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import SearchIcon from '@lucide/svelte/icons/search';
	import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';

	let students = $state<User[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');

	// Dialog states
	let addDialogOpen = $state(false);
	let editDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);

	let selectedStudent = $state<User | null>(null);
	let formSubmitting = $state(false);

	// Add Form fields
	let addName = $state('');
	let addEmail = $state('');
	let addPassword = $state('');
	let addRollNo = $state('');
	let addRoom = $state('');

	// Edit Form fields
	let editName = $state('');
	let editEmail = $state('');
	let editPassword = $state('');
	let editRollNo = $state('');
	let editRoom = $state('');

	const filteredStudents = $derived(
		students.filter((s) => {
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				const matchName = s.name.toLowerCase().includes(q);
				const matchEmail = s.email.toLowerCase().includes(q);
				const matchRoom = s.room?.toLowerCase().includes(q);
				const matchId = s.id.toLowerCase().includes(q);
				const matchRoll = s.rollNo?.toLowerCase().includes(q);
				return matchName || matchEmail || matchRoom || matchId || matchRoll;
			}
			return true;
		})
	);

	function formatDate(iso?: string): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	async function loadStudents() {
		loading = true;
		error = null;
		// Request students assigned to this warden
		const result = await userService.list('student');
		if (result.ok) {
			students = result.data;
		} else {
			error = result.error;
		}
		loading = false;
	}

	function openAddDialog() {
		addName = '';
		addEmail = '';
		addPassword = '';
		addRollNo = '';
		addRoom = '';
		addDialogOpen = true;
	}

	async function handleAddStudent(e: SubmitEvent) {
		e.preventDefault();
		if (!addName.trim() || !addEmail.trim() || !addPassword || !addRollNo.trim()) {
			toast.error('Please fill in name, email, roll number, and password.');
			return;
		}

		formSubmitting = true;
		const payload: CreateUserInput = {
			name: addName.trim(),
			email: addEmail.trim(),
			password: addPassword,
			role: 'student', // Wardens can only create students (assigned to themselves)
			rollNo: addRollNo.trim(),
			room: addRoom.trim() || undefined
		};

		const result = await userService.create(payload);
		formSubmitting = false;

		if (result.ok) {
			toast.success(`Student ${result.data.name} (Roll: ${result.data.rollNo}) registered successfully.`);
			addDialogOpen = false;
			await loadStudents();
		} else {
			toast.error('Could not add student.', { description: result.error });
		}
	}

	function openEditDialog(s: User) {
		selectedStudent = s;
		editName = s.name;
		editEmail = s.email;
		editPassword = '';
		editRollNo = s.rollNo ?? '';
		editRoom = s.room ?? '';
		editDialogOpen = true;
	}

	async function handleEditStudent(e: SubmitEvent) {
		e.preventDefault();
		if (!selectedStudent) return;
		if (!editName.trim() || !editEmail.trim() || !editRollNo.trim()) {
			toast.error('Name, Email, and Roll Number are required.');
			return;
		}

		formSubmitting = true;
		const payload: UpdateUserInput = {
			name: editName.trim(),
			email: editEmail.trim(),
			rollNo: editRollNo.trim(),
			room: editRoom.trim() || undefined
		};
		if (editPassword.trim()) {
			payload.password = editPassword.trim();
		}

		const result = await userService.update(selectedStudent.id, payload);
		formSubmitting = false;

		if (result.ok) {
			toast.success(`Student ${result.data.name} updated successfully.`);
			editDialogOpen = false;
			await loadStudents();
		} else {
			toast.error('Could not update student.', { description: result.error });
		}
	}

	function openDeleteDialog(s: User) {
		selectedStudent = s;
		deleteDialogOpen = true;
	}

	async function handleDeleteStudent() {
		if (!selectedStudent) return;

		formSubmitting = true;
		const result = await userService.delete(selectedStudent.id);
		formSubmitting = false;

		if (result.ok) {
			toast.success(`Student ${selectedStudent.name} removed from hostel registry.`);
			deleteDialogOpen = false;
			await loadStudents();
		} else {
			toast.error('Could not remove student.', { description: result.error });
		}
	}

	loadStudents();
</script>

<svelte:head><title>My Assigned Students · Warden Portal</title></svelte:head>

<PageHeader
	title="Student Directory & Management"
	description="Manage resident students assigned directly to your hostel wing."
>
	{#snippet actions()}
		<Button onclick={openAddDialog} class="gap-1.5 bg-foreground text-background hover:bg-foreground/90">
			<UserPlusIcon class="size-4" />
			Add Student
		</Button>
	{/snippet}
</PageHeader>

<!-- Controls: Search & Summary -->
<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<div class="flex items-center gap-2">
		<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-muted text-foreground border border-border">
			<GraduationCapIcon class="size-4" />
			Assigned Students: {students.length}
		</span>
	</div>

	<div class="relative w-full sm:w-72">
		<SearchIcon class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
		<Input
			type="search"
			placeholder="Search by name, roll no, room…"
			class="pl-9 h-9 text-xs"
			bind:value={searchQuery}
		/>
	</div>
</div>

{#if loading}
	<ListSkeleton rows={6} />
{:else if error}
	<ErrorState message={error} onRetry={loadStudents} />
{:else if filteredStudents.length === 0}
	<EmptyState
		title="No students assigned"
		description={searchQuery ? "No students match your search filter." : "No resident students currently assigned to your wing."}
	/>
{:else}
	<Card class="border">
		<CardContent class="px-0">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead class="w-24">Student ID</TableHead>
						<TableHead>Roll Number</TableHead>
						<TableHead>Student Name</TableHead>
						<TableHead>Email Address</TableHead>
						<TableHead>Allocated Room</TableHead>
						<TableHead>Registered</TableHead>
						<TableHead class="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each filteredStudents as s (s.id)}
						<TableRow>
							<TableCell class="font-mono text-xs text-muted-foreground">{s.id}</TableCell>
							<TableCell>
								{#if s.rollNo}
									<span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-semibold bg-muted border text-foreground">
										{s.rollNo}
									</span>
								{:else}
									<span class="text-xs text-muted-foreground italic">—</span>
								{/if}
							</TableCell>
							<TableCell class="font-medium text-foreground whitespace-nowrap">{s.name}</TableCell>
							<TableCell class="text-muted-foreground text-xs font-mono">{s.email}</TableCell>
							<TableCell>
								{#if s.room}
									<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-muted/60 text-foreground border">
										Room {s.room}
									</span>
								{:else}
									<span class="text-muted-foreground text-xs italic">Unassigned</span>
								{/if}
							</TableCell>
							<TableCell class="text-muted-foreground text-xs whitespace-nowrap">{formatDate(s.createdAt)}</TableCell>
							<TableCell class="text-right whitespace-nowrap">
								<div class="flex items-center justify-end gap-1">
									<Button
										variant="ghost"
										size="icon-sm"
										class="size-8 text-muted-foreground hover:text-foreground"
										onclick={() => openEditDialog(s)}
										title="Edit student"
									>
										<PencilIcon class="size-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon-sm"
										class="size-8 text-destructive hover:bg-destructive/10"
										onclick={() => openDeleteDialog(s)}
										title="Remove student"
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

<!-- ADD STUDENT DIALOG -->
<Dialog.Root bind:open={addDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add New Student</Dialog.Title>
			<Dialog.Description>Register a new resident student and assign their hostel room under your supervision.</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={handleAddStudent} class="space-y-3.5 py-2">
			<div class="space-y-1">
				<Label for="stu-add-name">Full Name *</Label>
				<Input id="stu-add-name" bind:value={addName} placeholder="e.g. Rahul Sharma" required />
			</div>
			<div class="space-y-1">
				<Label for="stu-add-roll">Student Roll Number *</Label>
				<Input id="stu-add-roll" bind:value={addRollNo} placeholder="e.g. 21BCE1042" required />
			</div>
			<div class="space-y-1">
				<Label for="stu-add-email">University Email *</Label>
				<Input id="stu-add-email" type="email" bind:value={addEmail} placeholder="e.g. rahul@giet.edu" required />
			</div>
			<div class="space-y-1">
				<Label for="stu-add-password">Initial Password *</Label>
				<Input id="stu-add-password" type="password" bind:value={addPassword} placeholder="•••••••• (min 6 characters)" required />
			</div>
			<div class="space-y-1">
				<Label for="stu-add-room">Hostel Room Number</Label>
				<Input id="stu-add-room" bind:value={addRoom} placeholder="e.g. A-102" />
			</div>
			<Dialog.Footer class="pt-3">
				<Button type="button" variant="outline" onclick={() => (addDialogOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={formSubmitting} class="bg-foreground text-background hover:bg-foreground/90">
					{formSubmitting ? 'Adding…' : 'Add Student'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- EDIT STUDENT DIALOG -->
<Dialog.Root bind:open={editDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Edit Student Details</Dialog.Title>
			<Dialog.Description>Update profile details or room allocation for {selectedStudent?.name}.</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={handleEditStudent} class="space-y-3.5 py-2">
			<div class="space-y-1">
				<Label for="stu-edit-name">Full Name *</Label>
				<Input id="stu-edit-name" bind:value={editName} required />
			</div>
			<div class="space-y-1">
				<Label for="stu-edit-roll">Student Roll Number *</Label>
				<Input id="stu-edit-roll" bind:value={editRollNo} required />
			</div>
			<div class="space-y-1">
				<Label for="stu-edit-email">University Email *</Label>
				<Input id="stu-edit-email" type="email" bind:value={editEmail} required />
			</div>
			<div class="space-y-1">
				<Label for="stu-edit-password">Reset Password (optional)</Label>
				<Input id="stu-edit-password" type="password" bind:value={editPassword} placeholder="Leave blank to keep existing password" />
			</div>
			<div class="space-y-1">
				<Label for="stu-edit-room">Hostel Room Number</Label>
				<Input id="stu-edit-room" bind:value={editRoom} placeholder="e.g. A-102" />
			</div>
			<Dialog.Footer class="pt-3">
				<Button type="button" variant="outline" onclick={() => (editDialogOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={formSubmitting} class="bg-foreground text-background hover:bg-foreground/90">
					{formSubmitting ? 'Saving…' : 'Save Changes'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- REMOVE STUDENT CONFIRMATION DIALOG -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Remove Student</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to remove <strong>{selectedStudent?.name}</strong> ({selectedStudent?.email}) from the hostel registry?
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="pt-3">
			<Button type="button" variant="outline" onclick={() => (deleteDialogOpen = false)}>Cancel</Button>
			<Button variant="destructive" onclick={handleDeleteStudent} disabled={formSubmitting}>
				{formSubmitting ? 'Removing…' : 'Remove Student'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
