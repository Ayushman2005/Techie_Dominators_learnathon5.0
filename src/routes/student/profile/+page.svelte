<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import { getSession } from '$lib/stores/auth.svelte';
	import { userService, grievanceService } from '$lib/services';
	import { toast } from 'svelte-sonner';
	import UserCircleIcon from '@lucide/svelte/icons/user-circle';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';

	const session = $derived(getSession());

	// Stats
	let statsLoading = $state(true);
	let stats = $state<{ total: number; open: number; resolved: number; inProgress: number } | null>(null);

	async function loadStats() {
		const result = await grievanceService.getStats();
		if (result.ok) {
			stats = {
				total: result.data.total,
				open: result.data.open,
				resolved: result.data.resolved,
				inProgress: result.data.inProgress
			};
		}
		statsLoading = false;
	}

	loadStats();

	// ── Update Profile ───────────────────────────────────────────────────────
	let phone = $state('');
	let emergencyContact = $state('');
	
	$effect(() => {
		if (session) {
			if (!phone) phone = session.phone ?? '';
			if (!emergencyContact) emergencyContact = session.emergencyContact ?? '';
		}
	});

	let updatingProfile = $state(false);

	async function handleUpdateProfile() {
		updatingProfile = true;
		const result = await userService.updateMyProfile({ phone, emergencyContact });
		updatingProfile = false;

		if (result.ok) {
			toast.success('Contact information updated successfully.');
			if (session) {
				session.phone = phone;
				session.emergencyContact = emergencyContact;
			}
		} else {
			toast.error('Could not update profile', { description: result.error });
		}
	}

	// ── Change Password ──────────────────────────────────────────────────────
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showCurrent = $state(false);
	let showNew = $state(false);
	let changingPassword = $state(false);
	let passwordChanged = $state(false);

	function validatePasswordForm(): string | null {
		if (!currentPassword) return 'Please enter your current password.';
		if (newPassword.length < 8) return 'New password must be at least 8 characters.';
		if (newPassword !== confirmPassword) return 'Passwords do not match.';
		if (newPassword === currentPassword) return 'New password must differ from the current one.';
		return null;
	}

	async function handleChangePassword() {
		const err = validatePasswordForm();
		if (err) {
			toast.error(err);
			return;
		}
		changingPassword = true;
		const result = await userService.changeMyPassword(currentPassword, newPassword);
		changingPassword = false;

		if (result.ok) {
			toast.success('Password changed successfully. Please log in again.');
			passwordChanged = true;
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		} else {
			toast.error('Could not change password', { description: result.error });
		}
	}

	function formatDate(iso?: string): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('en-IN', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<svelte:head><title>My Profile · HostelGrievance</title></svelte:head>

<PageHeader
	title="My Profile"
	description="Your account information and settings."
/>

<div class="grid gap-6 lg:grid-cols-3">
	<!-- ── Left: Profile Card ──────────────────────────────────────────────── -->
	<div class="space-y-4 lg:col-span-2">
		<Card>
			<CardHeader>
				<div class="flex items-center gap-3">
					<div class="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
						<UserCircleIcon class="size-6" />
					</div>
					<div>
						<CardTitle>{session?.name ?? '—'}</CardTitle>
						<CardDescription class="text-xs mt-0.5">{session?.email ?? '—'}</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<dl class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
					<div>
						<dt class="text-xs text-muted-foreground">Role</dt>
						<dd class="font-medium capitalize mt-0.5">{session?.role ?? '—'}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">Roll Number</dt>
						<dd class="font-mono text-xs mt-0.5">{session?.rollNo ?? '—'}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">Hostel Room</dt>
						<dd class="font-mono text-xs mt-0.5">{session?.room ?? '—'}</dd>
					</div>
					{#if session?.warden}
						<div>
							<dt class="text-xs text-muted-foreground">Assigned Warden</dt>
							<dd class="font-medium text-xs mt-0.5">{session.warden.name}</dd>
						</div>
					{/if}
					<div>
						<dt class="text-xs text-muted-foreground">Account Created</dt>
						<dd class="text-xs mt-0.5">{formatDate(session?.createdAt)}</dd>
					</div>
				</dl>

				<Separator class="my-5" />

				<!-- Grievance mini-stats -->
				<h3 class="text-sm font-semibold mb-3">My Grievances</h3>
				{#if statsLoading}
					<div class="flex gap-4">
						{#each [1, 2, 3] as _}
							<div class="h-12 w-24 rounded-lg bg-muted animate-pulse"></div>
						{/each}
					</div>
				{:else if stats}
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<div class="rounded-lg bg-muted/50 px-3 py-2 text-center">
							<p class="text-2xl font-bold tabular-nums">{stats.total}</p>
							<p class="text-xs text-muted-foreground">Total</p>
						</div>
						<div class="rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-center">
							<p class="text-2xl font-bold tabular-nums text-amber-600">{stats.open}</p>
							<p class="text-xs text-muted-foreground">Open</p>
						</div>
						<div class="rounded-lg bg-sky-50 dark:bg-sky-950/30 px-3 py-2 text-center">
							<p class="text-2xl font-bold tabular-nums text-sky-600">{stats.inProgress}</p>
							<p class="text-xs text-muted-foreground">In Progress</p>
						</div>
						<div class="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-center">
							<p class="text-2xl font-bold tabular-nums text-emerald-600">{stats.resolved}</p>
							<p class="text-xs text-muted-foreground">Resolved</p>
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>
		<!-- ── Contact Information Card ─────────────────────────────────────── -->
		<Card>
			<CardHeader>
				<CardTitle class="text-base">Contact Information</CardTitle>
				<CardDescription>
					Update your phone number and emergency contact details so your warden can reach you if necessary.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onsubmit={(e) => { e.preventDefault(); handleUpdateProfile(); }}
					class="space-y-4"
				>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-1.5">
							<Label for="phone">Phone Number</Label>
							<Input
								id="phone"
								bind:value={phone}
								placeholder="Your phone number"
								disabled={updatingProfile}
							/>
						</div>
						<div class="space-y-1.5">
							<Label for="emergency-contact">Emergency Contact</Label>
							<Input
								id="emergency-contact"
								bind:value={emergencyContact}
								placeholder="Parent/Guardian number"
								disabled={updatingProfile}
							/>
						</div>
					</div>
					<Button type="submit" disabled={updatingProfile}>
						{updatingProfile ? 'Saving…' : 'Save Changes'}
					</Button>
				</form>
			</CardContent>
		</Card>

		<!-- ── Change Password Card ─────────────────────────────────────── -->
		<Card>
			<CardHeader>
				<div class="flex items-center gap-2">
					<KeyRoundIcon class="size-4 text-primary" />
					<CardTitle class="text-base">Change Password</CardTitle>
				</div>
				<CardDescription>
					Use a strong, unique password. Changing your password will log you out of all other sessions.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{#if passwordChanged}
					<div class="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
						<ShieldCheckIcon class="size-5 shrink-0" />
						<div>
							<p class="font-medium">Password changed successfully!</p>
							<p class="text-xs mt-0.5">Please log in again with your new password.</p>
						</div>
					</div>
					<div class="mt-4">
						<Button variant="outline" href="/auth/login">Go to Login</Button>
					</div>
				{:else}
					<form
						onsubmit={(e) => { e.preventDefault(); handleChangePassword(); }}
						class="space-y-4"
					>
						<div class="space-y-1.5">
							<Label for="current-password">Current Password</Label>
							<div class="relative">
								<Input
									id="current-password"
									type={showCurrent ? 'text' : 'password'}
									bind:value={currentPassword}
									placeholder="Your current password"
									autocomplete="current-password"
									class="pr-10"
									disabled={changingPassword}
								/>
								<button
									type="button"
									class="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
									onclick={() => (showCurrent = !showCurrent)}
									tabindex="-1"
									aria-label={showCurrent ? 'Hide password' : 'Show password'}
								>
									{#if showCurrent}
										<EyeOffIcon class="size-4" />
									{:else}
										<EyeIcon class="size-4" />
									{/if}
								</button>
							</div>
						</div>

						<div class="space-y-1.5">
							<Label for="new-password">New Password</Label>
							<div class="relative">
								<Input
									id="new-password"
									type={showNew ? 'text' : 'password'}
									bind:value={newPassword}
									placeholder="Min. 8 characters"
									autocomplete="new-password"
									class="pr-10"
									disabled={changingPassword}
								/>
								<button
									type="button"
									class="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
									onclick={() => (showNew = !showNew)}
									tabindex="-1"
									aria-label={showNew ? 'Hide password' : 'Show password'}
								>
									{#if showNew}
										<EyeOffIcon class="size-4" />
									{:else}
										<EyeIcon class="size-4" />
									{/if}
								</button>
							</div>
						</div>

						<div class="space-y-1.5">
							<Label for="confirm-password">Confirm New Password</Label>
							<Input
								id="confirm-password"
								type="password"
								bind:value={confirmPassword}
								placeholder="Re-enter new password"
								autocomplete="new-password"
								disabled={changingPassword}
							/>
						</div>

						<Button type="submit" disabled={changingPassword} class="w-full sm:w-auto">
							{changingPassword ? 'Changing…' : 'Change Password'}
						</Button>
					</form>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- ── Right: Quick Links ─────────────────────────────────────────────── -->
	<div class="space-y-4">
		<Card class="py-4">
			<CardContent class="px-4 space-y-3">
				<h3 class="text-sm font-semibold">Quick Links</h3>
				<div class="space-y-1.5">
					<Button variant="outline" class="w-full justify-start text-sm" href="/student/grievances">
						My Grievances
					</Button>
					<Button variant="outline" class="w-full justify-start text-sm" href="/student/grievances/new">
						File New Grievance
					</Button>
					<Button variant="outline" class="w-full justify-start text-sm" href="/student/notices">
						Notice Board
					</Button>
				</div>
			</CardContent>
		</Card>

		<Card class="py-4">
			<CardContent class="px-4 space-y-2">
				<h3 class="text-sm font-semibold">Account Security</h3>
				<p class="text-xs text-muted-foreground leading-relaxed">
					Only your name and email are stored. Personal data (room, roll number) can be updated by your warden or admin.
				</p>
				<p class="text-xs text-muted-foreground leading-relaxed">
					You can change your password at any time using the form on this page.
				</p>
			</CardContent>
		</Card>
	</div>
</div>
