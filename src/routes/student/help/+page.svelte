<script lang="ts">
	import PageHeader from '$lib/components/app/page-header.svelte';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import HelpCircleIcon from '@lucide/svelte/icons/help-circle';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
</script>

<svelte:head>
	<title>Help & FAQ - Hostel Grievance</title>
</svelte:head>

<div class="space-y-6 max-w-4xl mx-auto">
	<PageHeader title="Help & FAQ" description="Learn how to use the application and find answers to common questions." />

	<div class="grid gap-6 md:grid-cols-2">
		<!-- Usage Guide -->
		<Card class="flex flex-col">
			<CardHeader>
				<div class="flex items-center gap-2">
					<BookOpenIcon class="size-5 text-primary" />
					<CardTitle>Usage Guide</CardTitle>
				</div>
				<CardDescription>Step-by-step instructions on how to use the portal.</CardDescription>
			</CardHeader>
			<CardContent class="flex-1 space-y-4">
				<div class="space-y-2">
					<h3 class="font-semibold text-sm">1. Filing a Grievance</h3>
					<p class="text-sm text-muted-foreground leading-relaxed">
						Navigate to the <strong>New Grievance</strong> page. Select an appropriate category (e.g., Water, Electricity), write a clear title, and describe your issue. You can optionally upload a photo (PNG or JPG) to provide visual proof.
					</p>
				</div>
				<div class="space-y-2">
					<h3 class="font-semibold text-sm">2. Tracking Your Grievances</h3>
					<p class="text-sm text-muted-foreground leading-relaxed">
						Your <strong>Dashboard</strong> provides a quick summary. Click on <strong>Grievances</strong> in the sidebar to see a full list. You can click on any grievance to view its details, check its current status (Open, In Progress, Resolved), and read comments from your Warden.
					</p>
				</div>
				<div class="space-y-2">
					<h3 class="font-semibold text-sm">3. Providing a Resolution Review</h3>
					<p class="text-sm text-muted-foreground leading-relaxed">
						Once a grievance is marked as <strong>Resolved</strong> by the Warden, you will see a prompt to leave a review. You must rate the resolution (1 to 5 stars), write brief feedback, and upload a picture showing the fixed issue.
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
				<CardDescription>Common queries regarding grievances and the system.</CardDescription>
			</CardHeader>
			<CardContent class="flex-1 space-y-4">
				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						How long does it take for a grievance to be resolved?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						It depends on the severity and category. Minor issues are usually resolved within 24-48 hours. Urgent maintenance issues are prioritized by the wardens.
					</p>
				</details>

				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						Can I edit or delete my grievance after submitting it?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						You can edit the details of your grievance as long as its status is still <strong>Open</strong>. Once it changes to In Progress or Resolved, edits are locked. Grievances cannot be deleted to maintain proper records.
					</p>
				</details>

				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						Who can see my grievances?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						Your grievances are only visible to you, your assigned Warden, and the Super Admin. Other students cannot see your complaints.
					</p>
				</details>
				
				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						What happens if I forget my password?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						Currently, you must contact your Warden or the Super Admin to have your password reset or updated manually from their dashboard.
					</p>
				</details>
			</CardContent>
		</Card>
	</div>
</div>
