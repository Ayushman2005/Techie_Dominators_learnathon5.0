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
	import * as Select from '$lib/components/ui/select/index.js';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import ErrorState from '$lib/components/app/error-state.svelte';
	import ListSkeleton from '$lib/components/app/list-skeleton.svelte';
	import { userService } from '$lib/services';
	import { getSession } from '$lib/stores/auth.svelte';
	import type { CreateUserInput, Role, UpdateUserInput, User } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import UserIcon from '@lucide/svelte/icons/user';
	import SchoolIcon from '@lucide/svelte/icons/school';

	const currentUser = $derived(getSession());

	let users = $state<User[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let activeTab = $state<'all' | Role>('all');
	let searchQuery = $state('');

	// Dialog states
	let addDialogOpen = $state(false);
	let editDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);

	let selectedUser = $state<User | null>(null);
	let formSubmitting = $state(false);

	// Add Form fields
	let addName = $state('');
	let addEmail = $state('');
	let addPassword = $state('');
	let addRole = $state<Role>('student');
	let addRoom = $state('');

	// Edit Form fields
	let editName = $state('');
	let editEmail = $state('');
	let editPassword = $state('');
	let editRole = $state<Role>('student');
	let editRoom = $state('');

	const filteredUsers = $derived(
		users.filter((u) => {
			if (activeTab !== 'all' && u.role !== activeTab) return false;
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				const matchName = u.name.toLowerCase().includes(q);
				const matchEmail = u.email.toLowerCase().includes(q);
				const matchRoom = u.room?.toLowerCase().includes(q);
				const matchId = u.id.toLowerCase().includes(q);
				return matchName || matchEmail || matchRoom || matchId;
			}
			return true;
		})
	);

	function formatDate(iso?: string): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	async function loadUsers() {
		loading = true;
		error = null;
		const result = await userService.list();
		if (result.ok) {
			users = result.data;
		} else {
			error = result.error;
		}
		loading = false;
	}

	function openAddDialog() {
		addName = '';
		addEmail = '';
		addPassword = '';
		addRole = 'student';
		addRoom = '';
		addDialogOpen = true;
	}

	async function handleAddUser(e: SubmitEvent) {
		e.preventDefault();
		if (!addName.trim() || !addEmail.trim() || !addPassword) {
			toast.error('Please fill in all required fields.');
			return;
		}

		formSubmitting = true;
		const payload: CreateUserInput = {
			name: addName.trim(),
			email: addEmail.trim(),
			password: addPassword,
			role: addRole,
			room: addRole === 'student' ? addRoom.trim() : undefined
		};

		const result = await userService.create(payload);
		formSubmitting = false;

		if (result.ok) {
			toast.success(`User ${result.data.name} (${result.data.role}) created successfully.`);
			addDialogOpen = false;
			await loadUsers();
		} else {
			toast.error('Could not create user.', { description: result.error });
		}
	}

	function openEditDialog(u: User) {
		selectedUser = u;
		editName = u.name;
		editEmail = u.email;
		editPassword = '';
		editRole = u.role;
		editRoom = u.room ?? '';
		editDialogOpen = true;
	}

	async function handleEditUser(e: SubmitEvent) {
		e.preventDefault();
		if (!selectedUser) return;
		if (!editName.trim() || !editEmail.trim()) {
			toast.error('Name and Email are required.');
			return;
		}

		formSubmitting = true;
		const payload: UpdateUserInput = {
			name: editName.trim(),
			email: editEmail.trim(),
			role: editRole,
			room: editRole === 'student' ? editRoom.trim() : undefined
		};
		if (editPassword.trim()) {
			payload.password = editPassword.trim();
		}

		const result = await userService.update(selectedUser.id, payload);
		formSubmitting = false;

		if (result.ok) {
			toast.success(`User ${result.data.name} updated successfully.`);
			editDialogOpen = false;
			await loadUsers();
		} else {
			toast.error('Could not update user.', { description: result.error });
		}
	}

	function openDeleteDialog(u: User) {
		selectedUser = u;
		deleteDialogOpen = true;
	}

	async function handleDeleteUser() {
		if (!selectedUser) return;
		if (selectedUser.id === currentUser?.id) {
			toast.error('You cannot delete your own account while signed in.');
			return;
		}

		formSubmitting = true;
		const result = await userService.delete(selectedUser.id);
		formSubmitting = false;

		if (result.ok) {
			toast.success(`User ${selectedUser.name} deleted.`);
			deleteDialogOpen = false;
			await loadUsers();
		} else {
			toast.error('Could not delete user.', { description: result.error });
		}
	}

	loadUsers();
</script>

<svelte:head><title>User Management · HostelGrievance Admin</title></svelte:head>

<PageHeader
	title="User Management"
	description="Add, edit, or remove student, warden, and administrator accounts."
>
	{#snippet actions()}
		<Button onclick={openAddDialog} class="gap-1.5">
			<UserPlusIcon class="size-4" />
			Add User
		</Button>
	{/snippet}
</PageHeader>

<!-- Controls: Role Filter & Search -->
<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<div class="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
		<Button
			variant={activeTab === 'all' ? 'secondary' : 'ghost'}
			size="sm"
			class="text-xs h-7 px-3"
			onclick={() => (activeTab = 'all')}
		>
			All ({users.length})
		</Button>
		<Button
			variant={activeTab === 'student' ? 'secondary' : 'ghost'}
			size="sm"
			class="text-xs h-7 px-3"
			onclick={() => (activeTab = 'student')}
		>
			Students ({users.filter((u) => u.role === 'student').length})
		</Button>
		<Button
			variant={activeTab === 'warden' ? 'secondary' : 'ghost'}
			size="sm"
			class="text-xs h-7 px-3"
			onclick={() => (activeTab = 'warden')}
		>
			Wardens ({users.filter((u) => u.role === 'warden').length})
		</Button>
		<Button
			variant={activeTab === 'admin' ? 'secondary' : 'ghost'}
			size="sm"
			class="text-xs h-7 px-3"
			onclick={() => (activeTab = 'admin')}
		>
			Admins ({users.filter((u) => u.role === 'admin').length})
		</Button>
	</div>

	<div class="relative w-full sm:w-64">
		<SearchIcon class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
		<Input
			type="search"
			placeholder="Search by name, email, room…"
			class="pl-9 h-9 text-xs"
			bind:value={searchQuery}
		/>
	</div>
</div>

{#if loading}
	<ListSkeleton rows={6} />
{:else if error}
	<ErrorState message={error} onRetry={loadUsers} />
{:else if filteredUsers.length === 0}
	<EmptyState
		title="No users found"
		description={searchQuery ? "No accounts match your search filter." : "No user accounts registered under this role."}
	/>
{:else}
	<Card>
		<CardContent class="px-0">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead class="w-20">ID</TableHead>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Role</TableHead>
						<TableHead>Room</TableHead>
						<TableHead>Created</TableHead>
						<TableHead class="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each filteredUsers as u (u.id)}
						<TableRow>
							<TableCell class="font-mono text-xs text-muted-foreground">{u.id}</TableCell>
							<TableCell class="font-medium whitespace-nowrap">{u.name}</TableCell>
							<TableCell class="text-muted-foreground text-xs">{u.email}</TableCell>
							<TableCell>
								{#if u.role === 'admin'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
										<ShieldIcon class="size-3" />
										Admin
									</span>
								{:else if u.role === 'warden'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
										<SchoolIcon class="size-3" />
										Warden
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
										<UserIcon class="size-3" />
										Student
									</span>
								{/if}
							</TableCell>
							<TableCell class="text-muted-foreground text-xs">{u.room ?? '—'}</TableCell>
							<TableCell class="text-muted-foreground text-xs whitespace-nowrap">{formatDate(u.createdAt)}</TableCell>
							<TableCell class="text-right whitespace-nowrap">
								<div class="flex items-center justify-end gap-1">
									<Button
										variant="ghost"
										size="icon-sm"
										class="size-8 text-muted-foreground hover:text-foreground"
										onclick={() => openEditDialog(u)}
										title="Edit user"
									>
										<PencilIcon class="size-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon-sm"
										class="size-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
										disabled={u.id === currentUser?.id}
										onclick={() => openDeleteDialog(u)}
										title={u.id === currentUser?.id ? "Cannot delete self" : "Delete user"}
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

<!-- ADD USER DIALOG -->
<Dialog.Root bind:open={addDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add New User</Dialog.Title>
			<Dialog.Description>Create a new student, warden, or administrator account.</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={handleAddUser} class="space-y-3.5 py-2">
			<div class="space-y-1">
				<Label for="add-name">Full Name *</Label>
				<Input id="add-name" bind:value={addName} placeholder="e.g. Ramesh Chandra" required />
			</div>
			<div class="space-y-1">
				<Label for="add-email">Email Address *</Label>
				<Input id="add-email" type="email" bind:value={addEmail} placeholder="e.g. ramesh@giet.edu" required />
			</div>
			<div class="space-y-1">
				<Label for="add-password">Initial Password *</Label>
				<Input id="add-password" type="password" bind:value={addPassword} placeholder="•••••••• (min 6 characters)" required />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="add-role">Role *</Label>
					<select
						id="add-role"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						bind:value={addRole}
					>
						<option value="student">Student</option>
						<option value="warden">Warden</option>
						<option value="admin">Admin</option>
					</select>
				</div>
				<div class="space-y-1">
					<Label for="add-room">Hostel Room</Label>
					<Input
						id="add-room"
						bind:value={addRoom}
						placeholder="e.g. B-204"
						disabled={addRole !== 'student'}
					/>
				</div>
			</div>
			<Dialog.Footer class="pt-3">
				<Button type="button" variant="outline" onclick={() => (addDialogOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={formSubmitting}>
					{formSubmitting ? 'Creating…' : 'Create User'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- EDIT USER DIALOG -->
<Dialog.Root bind:open={editDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Edit User Account</Dialog.Title>
			<Dialog.Description>Update profile details or reset password for {selectedUser?.name}.</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={handleEditUser} class="space-y-3.5 py-2">
			<div class="space-y-1">
				<Label for="edit-name">Full Name *</Label>
				<Input id="edit-name" bind:value={editName} required />
			</div>
			<div class="space-y-1">
				<Label for="edit-email">Email Address *</Label>
				<Input id="edit-email" type="email" bind:value={editEmail} required />
			</div>
			<div class="space-y-1">
				<Label for="edit-password">New Password (leave empty to keep current)</Label>
				<Input id="edit-password" type="password" bind:value={editPassword} placeholder="Leave blank to keep unchanged" />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="edit-role">Role *</Label>
					<select
						id="edit-role"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						bind:value={editRole}
					>
						<option value="student">Student</option>
						<option value="warden">Warden</option>
						<option value="admin">Admin</option>
					</select>
				</div>
				<div class="space-y-1">
					<Label for="edit-room">Hostel Room</Label>
					<Input
						id="edit-room"
						bind:value={editRoom}
						placeholder="e.g. B-204"
						disabled={editRole !== 'student'}
					/>
				</div>
			</div>
			<Dialog.Footer class="pt-3">
				<Button type="button" variant="outline" onclick={() => (editDialogOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={formSubmitting}>
					{formSubmitting ? 'Saving…' : 'Save Changes'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- DELETE USER CONFIRMATION DIALOG -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete User Account</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to permanently delete <strong>{selectedUser?.name}</strong> ({selectedUser?.email})? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="pt-3">
			<Button type="button" variant="outline" onclick={() => (deleteDialogOpen = false)}>Cancel</Button>
			<Button variant="destructive" onclick={handleDeleteUser} disabled={formSubmitting}>
				{formSubmitting ? 'Deleting…' : 'Delete Account'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
