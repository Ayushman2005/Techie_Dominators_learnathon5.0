<script lang="ts">
	import PageHeader from '$lib/components/app/page-header.svelte';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import HelpCircleIcon from '@lucide/svelte/icons/help-circle';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
</script>

<svelte:head>
	<title>Help & FAQ - Admin Dashboard</title>
</svelte:head>

<div class="space-y-6 max-w-4xl mx-auto">
	<PageHeader title="Help & FAQ" description="Super Admin's guide to system architecture and user management." />

	<div class="grid gap-6 md:grid-cols-2">
		<!-- Usage Guide -->
		<Card class="flex flex-col">
			<CardHeader>
				<div class="flex items-center gap-2">
					<BookOpenIcon class="size-5 text-primary" />
					<CardTitle>Usage Guide</CardTitle>
				</div>
				<CardDescription>Step-by-step instructions on administrative duties.</CardDescription>
			</CardHeader>
			<CardContent class="flex-1 space-y-4">
				<div class="space-y-2">
					<h3 class="font-semibold text-sm">1. Managing Hostels & Wardens</h3>
					<p class="text-sm text-muted-foreground leading-relaxed">
						To initialize the system, first create a Hostel in the <strong>Hostels</strong> tab. Then, go to the <strong>User Management</strong> tab to add a Warden. When creating or editing the Warden, select the Hostel they will oversee.
					</p>
				</div>
				<div class="space-y-2">
					<h3 class="font-semibold text-sm">2. Assigning Students</h3>
					<p class="text-sm text-muted-foreground leading-relaxed">
						Similarly, when adding a new Student via <strong>User Management</strong>, you can assign them to a specific Hostel. The student will then automatically appear under the designated Warden's dashboard, forming a clear hierarchy.
					</p>
				</div>
				<div class="space-y-2">
					<h3 class="font-semibold text-sm">3. Global Oversight</h3>
					<p class="text-sm text-muted-foreground leading-relaxed">
						You have access to <strong>All Grievances</strong> and the global <strong>Notice Board</strong>. You can post system-wide notices, view all complaints across all hostels, and utilize the <strong>Audit Logs</strong> to monitor all critical actions taken by users and wardens.
					</p>
				</div>
			</CardContent>
		</Card>

		<!-- FAQ -->
		<Card class="flex flex-col">
			<CardHeader>
				<div class="flex items-center gap-2">
					<MessageSquareIcon class="size-5 text-primary" />
					<CardTitle>Frequently Asked Questions</CardTitle>
				</div>
				<CardDescription>Common queries from Administrators.</CardDescription>
			</CardHeader>
			<CardContent class="flex-1 space-y-4">
				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						Can I reset a user's password?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						Yes. In the <strong>User Management</strong> section, edit the specific user's profile and enter a new password for them. They will use this new password on their next login.
					</p>
				</details>

				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						What does the Audit Log track?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						The Audit Log is a tamper-proof ledger of critical system events. It automatically records actions like user logins, profile updates, grievance creations, and status changes for accountability.
					</p>
				</details>

				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						Can I delete a hostel?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						Yes, but please proceed with caution. Deleting a hostel will unlink any wardens or students currently assigned to it, placing them in an "unassigned" state until you allocate them to a new hostel.
					</p>
				</details>
				
				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						Can an Admin post notices to a specific hostel?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						Yes. When creating a notice, the Admin can choose to make it visible to "All Hostels" (system-wide) or target a specific hostel, ensuring precise communication.
					</p>
				</details>
			</CardContent>
		</Card>
	</div>
</div>
