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
	import { userService, hostelService } from '$lib/services';
	import { getSession } from '$lib/stores/auth.svelte';
	import type { CreateUserInput, Role, UpdateUserInput, User, Hostel } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import UserIcon from '@lucide/svelte/icons/user';
	import SchoolIcon from '@lucide/svelte/icons/school';
	import UserCheckIcon from '@lucide/svelte/icons/user-check';

	const currentUser = $derived(getSession());

	let users = $state<User[]>([]);
	let wardens = $state<User[]>([]);
	let hostels = $state<Hostel[]>([]);
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
	let addRollNo = $state('');
	let addEmpId = $state('');
	let addWardenId = $state('');
	let addHostelId = $state('');

	// Edit Form fields
	let editName = $state('');
	let editEmail = $state('');
	let editPassword = $state('');
	let editRole = $state<Role>('student');
	let editRoom = $state('');
	let editRollNo = $state('');
	let editEmpId = $state('');
	let editWardenId = $state('');
	let editHostelId = $state('');

	const filteredUsers = $derived(
		users.filter((u) => {
			if (activeTab !== 'all' && u.role !== activeTab) return false;
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				const matchName = u.name.toLowerCase().includes(q);
				const matchEmail = u.email.toLowerCase().includes(q);
				const matchRoom = u.room?.toLowerCase().includes(q);
				const matchId = u.id.toLowerCase().includes(q);
				const matchRoll = u.rollNo?.toLowerCase().includes(q);
				const matchEmp = u.empId?.toLowerCase().includes(q);
				const matchWarden = u.warden?.name.toLowerCase().includes(q);
				return matchName || matchEmail || matchRoom || matchId || matchRoll || matchEmp || matchWarden;
			}
			return true;
		})
	);

	function formatDate(iso?: string): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function getHostelName(hostelId?: string | null): string | null {
		if (!hostelId) return null;
		const h = hostels.find(h => h.id === hostelId);
		return h ? h.name : null;
	}

	async function loadData() {
		loading = true;
		error = null;
		const [usersRes, wardensRes, hostelsRes] = await Promise.all([
			userService.list(),
			userService.listWardens(),
			hostelService.list()
		]);

		if (usersRes.ok) {
			users = usersRes.data;
		} else {
			error = usersRes.error;
		}

		if (wardensRes.ok) {
			wardens = wardensRes.data;
		}

		if (hostelsRes.ok) {
			hostels = hostelsRes.data;
		}

		loading = false;
	}

	function openAddDialog() {
		addName = '';
		addEmail = '';
		addPassword = '';
		addRole = 'student';
		addRoom = '';
		addRollNo = '';
		addEmpId = '';
		addWardenId = wardens.length > 0 ? wardens[0].id : '';
		addHostelId = hostels.length > 0 ? hostels[0].id : '';
		addDialogOpen = true;
	}

	async function handleAddUser(e: SubmitEvent) {
		e.preventDefault();
		if (!addName.trim() || !addEmail.trim() || !addPassword) {
			toast.error('Please fill in all required fields.');
			return;
		}

		if (addRole === 'student') {
			if (!addRollNo.trim()) {
				toast.error('Student ID (Roll Number) is mandatory for students.');
				return;
			}
			if (!addWardenId.trim()) {
				toast.error('Please select an assigned warden. Each student must be under one warden.');
				return;
			}
		}

		if (addRole === 'warden' && !addEmpId.trim()) {
			toast.error('Warden Employee ID (Emp ID) is mandatory for wardens.');
			return;
		}

		formSubmitting = true;
		const payload: CreateUserInput = {
			name: addName.trim(),
			email: addEmail.trim(),
			password: addPassword,
			role: addRole,
			room: addRole === 'student' ? addRoom.trim() || undefined : undefined,
			rollNo: addRole === 'student' ? addRollNo.trim() || undefined : undefined,
			studentId: addRole === 'student' ? addRollNo.trim() || undefined : undefined,
			empId: addRole === 'warden' || addRole === 'admin' ? addEmpId.trim() || undefined : undefined,
			wardenId: addRole === 'student' ? addWardenId.trim() || undefined : undefined,
			hostelId: addHostelId.trim() || undefined
		};

		const result = await userService.create(payload);
		formSubmitting = false;

		if (result.ok) {
			toast.success(`User ${result.data.name} (${result.data.role}) created successfully.`);
			addDialogOpen = false;
			await loadData();
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
		editRollNo = u.rollNo ?? '';
		editEmpId = u.empId ?? '';
		editWardenId = u.wardenId ?? (wardens.length > 0 ? wardens[0].id : '');
		editHostelId = u.hostelId ?? (hostels.length > 0 ? hostels[0].id : '');
		editDialogOpen = true;
	}

	async function handleEditUser(e: SubmitEvent) {
		e.preventDefault();
		if (!selectedUser) return;
		if (!editName.trim() || !editEmail.trim()) {
			toast.error('Name and Email are required.');
			return;
		}

		if (editRole === 'student') {
			if (!editRollNo.trim()) {
				toast.error('Student ID (Roll Number) is mandatory for students.');
				return;
			}
			if (!editWardenId.trim()) {
				toast.error('Please select an assigned warden. Each student must be under one warden.');
				return;
			}
		}

		if (editRole === 'warden' && !editEmpId.trim()) {
			toast.error('Warden Employee ID (Emp ID) is mandatory for wardens.');
			return;
		}

		formSubmitting = true;
		const payload: UpdateUserInput = {
			name: editName.trim(),
			email: editEmail.trim(),
			role: editRole,
			room: editRole === 'student' ? editRoom.trim() || undefined : undefined,
			rollNo: editRole === 'student' ? editRollNo.trim() || undefined : undefined,
			studentId: editRole === 'student' ? editRollNo.trim() || undefined : undefined,
			empId: editRole === 'warden' || editRole === 'admin' ? editEmpId.trim() || undefined : undefined,
			wardenId: editRole === 'student' ? editWardenId.trim() || undefined : undefined,
			hostelId: editHostelId.trim() || undefined
		};
		if (editPassword.trim()) {
			payload.password = editPassword.trim();
		}

		const result = await userService.update(selectedUser.id, payload);
		formSubmitting = false;

		if (result.ok) {
			toast.success(`User ${result.data.name} updated successfully.`);
			editDialogOpen = false;
			await loadData();
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
			await loadData();
		} else {
			toast.error('Could not delete user.', { description: result.error });
		}
	}

	loadData();
</script>

<svelte:head><title>User Directory & Management · Admin Panel</title></svelte:head>

<PageHeader
	title="User Directory & Management"
	description="Comprehensive registry of students with Roll No., wardens with Employee ID, and 1-to-1 warden assignments."
>
	{#snippet actions()}
		<Button onclick={openAddDialog} class="gap-1.5 bg-foreground text-background hover:bg-foreground/90">
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
			class="text-xs h-7 px-3 {activeTab === 'all' ? 'bg-foreground text-background' : 'text-foreground'}"
			onclick={() => (activeTab = 'all')}
		>
			All ({users.length})
		</Button>
		<Button
			variant={activeTab === 'student' ? 'secondary' : 'ghost'}
			size="sm"
			class="text-xs h-7 px-3 {activeTab === 'student' ? 'bg-foreground text-background' : 'text-foreground'}"
			onclick={() => (activeTab = 'student')}
		>
			Students ({users.filter((u) => u.role === 'student').length})
		</Button>
		<Button
			variant={activeTab === 'warden' ? 'secondary' : 'ghost'}
			size="sm"
			class="text-xs h-7 px-3 {activeTab === 'warden' ? 'bg-foreground text-background' : 'text-foreground'}"
			onclick={() => (activeTab = 'warden')}
		>
			Wardens ({users.filter((u) => u.role === 'warden').length})
		</Button>
		<Button
			variant={activeTab === 'admin' ? 'secondary' : 'ghost'}
			size="sm"
			class="text-xs h-7 px-3 {activeTab === 'admin' ? 'bg-foreground text-background' : 'text-foreground'}"
			onclick={() => (activeTab = 'admin')}
		>
			Admins ({users.filter((u) => u.role === 'admin').length})
		</Button>
	</div>

	<div class="relative w-full sm:w-72">
		<SearchIcon class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
		<Input
			type="search"
			placeholder="Search by name, roll no, emp ID, room…"
			class="pl-9 h-9 text-xs"
			bind:value={searchQuery}
		/>
	</div>
</div>

{#if loading}
	<ListSkeleton rows={6} />
{:else if error}
	<ErrorState message={error} onRetry={loadData} />
{:else if filteredUsers.length === 0}
	<EmptyState
		title="No users found"
		description={searchQuery ? "No accounts match your search filter." : "No user accounts registered under this role."}
	/>
{:else}
	<Card class="border">
		<CardContent class="px-0">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead class="w-20">User ID</TableHead>
						<TableHead>User Details</TableHead>
						<TableHead>Identifier (Roll / Emp)</TableHead>
						<TableHead>Role</TableHead>
						<TableHead>Hostel & Room</TableHead>
						<TableHead>Assigned Warden</TableHead>
						<TableHead>Registered</TableHead>
						<TableHead class="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each filteredUsers as u (u.id)}
						<TableRow>
							<TableCell class="font-mono text-xs text-muted-foreground">{u.id}</TableCell>
							<TableCell class="whitespace-nowrap">
								<div class="font-medium text-foreground">{u.name}</div>
								<div class="text-xs text-muted-foreground font-mono">{u.email}</div>
							</TableCell>
							<TableCell class="whitespace-nowrap">
								{#if u.role === 'student'}
									{#if u.rollNo}
										<span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-semibold bg-muted border text-foreground">
											Roll: {u.rollNo}
										</span>
									{:else}
										<span class="text-xs text-muted-foreground italic">No Roll No</span>
									{/if}
								{:else if u.empId}
									<span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-semibold bg-foreground text-background">
										Emp: {u.empId}
									</span>
								{:else}
									<span class="text-xs text-muted-foreground">—</span>
								{/if}
							</TableCell>
							<TableCell>
								{#if u.role === 'admin'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-foreground text-background">
										<ShieldIcon class="size-3" />
										Admin
									</span>
								{:else if u.role === 'warden'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
										<SchoolIcon class="size-3" />
										Warden
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted/60 text-foreground border border-border/80">
										<UserIcon class="size-3" />
										Student
									</span>
								{/if}
							</TableCell>
							<TableCell class="text-xs">
								{#if u.hostelId}
									<div class="font-medium text-foreground">{getHostelName(u.hostelId) ?? 'Unknown Hostel'}</div>
									<div class="text-muted-foreground font-mono">{u.room ?? 'No Room'}</div>
								{:else}
									<span class="text-muted-foreground font-mono">—</span>
								{/if}
							</TableCell>
							<TableCell class="text-xs whitespace-nowrap">
								{#if u.role === 'student'}
									{#if u.warden}
										<div class="flex items-center gap-1.5 text-foreground font-medium">
											<UserCheckIcon class="size-3.5 text-muted-foreground" />
											<span>{u.warden.name}</span>
											{#if u.warden.empId}
												<span class="font-mono text-[11px] text-muted-foreground">({u.warden.empId})</span>
											{/if}
										</div>
									{:else}
										<span class="text-muted-foreground italic">Unassigned</span>
									{/if}
								{:else}
									<span class="text-muted-foreground">—</span>
								{/if}
							</TableCell>
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
										class="size-8 text-destructive hover:bg-destructive/10"
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
			<Dialog.Description>Register a student with Roll No. & Warden, or a staff member with Employee ID.</Dialog.Description>
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
				<Input id="add-password" type="password" bind:value={addPassword} placeholder="•••••••• (min 12 characters)" required />
			</div>
			
			<!-- Role Selector -->
			<div class="space-y-1">
				<Label for="add-role">Account Role *</Label>
				<select
					id="add-role"
					class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					bind:value={addRole}
				>
					<option value="student">Student</option>
					<option value="warden">Warden</option>
					<option value="admin">Administrator</option>
				</select>
			</div>

			{#if addRole === 'student' || addRole === 'warden'}
				<div class="space-y-1">
					<Label for="add-hostel">Assigned Hostel</Label>
					<select
						id="add-hostel"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						bind:value={addHostelId}
					>
						{#if hostels.length === 0}
							<option value="" disabled>No hostels available — create a hostel first</option>
						{:else}
							<option value="">— Select Hostel (Optional) —</option>
							{#each hostels as h}
								<option value={h.id}>{h.name}</option>
							{/each}
						{/if}
					</select>
				</div>
			{/if}

			{#if addRole === 'student'}
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="add-roll">Student ID (Roll No) *</Label>
						<Input id="add-roll" bind:value={addRollNo} placeholder="e.g. 21BCE1042" required />
					</div>
					<div class="space-y-1">
						<Label for="add-room">Hostel Room</Label>
						<Input id="add-room" bind:value={addRoom} placeholder="e.g. B-204" />
					</div>
				</div>

				<!-- Assigned Warden Dropdown -->
				<div class="space-y-1">
					<Label for="add-warden">Assigned Warden (Mandatory 1-to-1 Mapping) *</Label>
					<select
						id="add-warden"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						bind:value={addWardenId}
						required
					>
						{#if wardens.length === 0}
							<option value="" disabled>No active wardens available — create a warden first</option>
						{:else}
							<option value="" disabled>— Select Assigned Warden —</option>
							{#each wardens as w}
								<option value={w.id}>{w.name} {w.empId ? `(Emp ID: ${w.empId})` : `(${w.id})`}</option>
							{/each}
						{/if}
					</select>
					<p class="text-[11px] text-muted-foreground">Each student is managed strictly by this designated warden.</p>
				</div>
			{:else if addRole === 'warden'}
				<div class="space-y-1">
					<Label for="add-emp">Warden Employee ID (Emp ID) *</Label>
					<Input id="add-emp" bind:value={addEmpId} placeholder="e.g. EMP-1001" required />
				</div>
			{:else if addRole === 'admin'}
				<div class="space-y-1">
					<Label for="add-admin-emp">Administrator Employee ID (Optional)</Label>
					<Input id="add-admin-emp" bind:value={addEmpId} placeholder="e.g. ADM-0001" />
				</div>
			{/if}

			<Dialog.Footer class="pt-3">
				<Button type="button" variant="outline" onclick={() => (addDialogOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={formSubmitting} class="bg-foreground text-background hover:bg-foreground/90">
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
			<Dialog.Description>Update profile details, student ID, employee ID, or warden assignment for {selectedUser?.name}.</Dialog.Description>
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

			<div class="space-y-1">
				<Label for="edit-role">Role *</Label>
				<select
					id="edit-role"
					class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					bind:value={editRole}
				>
					<option value="student">Student</option>
					<option value="warden">Warden</option>
					<option value="admin">Administrator</option>
				</select>
			</div>

			{#if editRole === 'student' || editRole === 'warden'}
				<div class="space-y-1">
					<Label for="edit-hostel">Assigned Hostel</Label>
					<select
						id="edit-hostel"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						bind:value={editHostelId}
					>
						{#if hostels.length === 0}
							<option value="" disabled>No hostels available</option>
						{:else}
							<option value="">— Select Hostel (Optional) —</option>
							{#each hostels as h}
								<option value={h.id}>{h.name}</option>
							{/each}
						{/if}
					</select>
				</div>
			{/if}

			{#if editRole === 'student'}
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="edit-roll">Student ID (Roll No) *</Label>
						<Input id="edit-roll" bind:value={editRollNo} placeholder="e.g. 21BCE1042" required />
					</div>
					<div class="space-y-1">
						<Label for="edit-room">Hostel Room</Label>
						<Input id="edit-room" bind:value={editRoom} placeholder="e.g. B-204" />
					</div>
				</div>

				<!-- Assigned Warden Dropdown -->
				<div class="space-y-1">
					<Label for="edit-warden">Assigned Warden (Mandatory 1-to-1 Mapping) *</Label>
					<select
						id="edit-warden"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						bind:value={editWardenId}
						required
					>
						{#if wardens.length === 0}
							<option value="" disabled>No active wardens available</option>
						{:else}
							<option value="" disabled>— Select Assigned Warden —</option>
							{#each wardens as w}
								<option value={w.id}>{w.name} {w.empId ? `(Emp ID: ${w.empId})` : `(${w.id})`}</option>
							{/each}
						{/if}
					</select>
				</div>
			{:else if editRole === 'warden'}
				<div class="space-y-1">
					<Label for="edit-emp">Warden Employee ID (Emp ID) *</Label>
					<Input id="edit-emp" bind:value={editEmpId} placeholder="e.g. EMP-1001" required />
				</div>
			{:else if editRole === 'admin'}
				<div class="space-y-1">
					<Label for="edit-admin-emp">Administrator Employee ID (Optional)</Label>
					<Input id="edit-admin-emp" bind:value={editEmpId} placeholder="e.g. ADM-0001" />
				</div>
			{/if}

			<Dialog.Footer class="pt-3">
				<Button type="button" variant="outline" onclick={() => (editDialogOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={formSubmitting} class="bg-foreground text-background hover:bg-foreground/90">
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
