<script lang="ts">
	import PageHeader from '$lib/components/app/page-header.svelte';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import HelpCircleIcon from '@lucide/svelte/icons/help-circle';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
</script>

<svelte:head>
	<title>Help & FAQ - Warden Dashboard</title>
</svelte:head>

<div class="space-y-6 max-w-4xl mx-auto">
	<PageHeader title="Help & FAQ" description="Warden's guide to managing students, grievances, and notices." />

	<div class="grid gap-6 md:grid-cols-2">
		<!-- Usage Guide -->
		<Card class="flex flex-col">
			<CardHeader>
				<div class="flex items-center gap-2">
					<BookOpenIcon class="size-5 text-primary" />
					<CardTitle>Usage Guide</CardTitle>
				</div>
				<CardDescription>Step-by-step instructions on your primary duties.</CardDescription>
			</CardHeader>
			<CardContent class="flex-1 space-y-4">
				<div class="space-y-2">
					<h3 class="font-semibold text-sm">1. Managing Grievances</h3>
					<p class="text-sm text-muted-foreground leading-relaxed">
						Visit the <strong>Grievances</strong> tab to view complaints filed by students in your assigned hostel. You can update the status from Open to In Progress, and finally to Resolved once fixed. You can also comment on grievances to communicate with the student.
					</p>
				</div>
				<div class="space-y-2">
					<h3 class="font-semibold text-sm">2. Notice Board</h3>
					<p class="text-sm text-muted-foreground leading-relaxed">
						Use the <strong>Notice Board</strong> section to broadcast announcements (like scheduled power cuts, water maintenance, etc.). Any notice you post will be instantly visible on the dashboard of all students residing in your assigned hostel.
					</p>
				</div>
				<div class="space-y-2">
					<h3 class="font-semibold text-sm">3. Managing Students</h3>
					<p class="text-sm text-muted-foreground leading-relaxed">
						The <strong>Manage Students</strong> tab displays all students currently assigned to your hostel. You can view their details, roll numbers, and assigned room numbers for quick communication.
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
				<CardDescription>Common queries from Wardens.</CardDescription>
			</CardHeader>
			<CardContent class="flex-1 space-y-4">
				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						Can I edit the description of a student's grievance?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						No. To maintain data integrity, you cannot alter a student's original grievance text. However, you can add Comments or alter its Status.
					</p>
				</details>

				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						How are students assigned to my dashboard?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						Student allocation is handled by the Super Admin. The Super Admin assigns you as the Warden of a specific hostel, and all students assigned to that hostel automatically appear in your dashboard.
					</p>
				</details>

				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						Who can see the notices I post?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						The notices you create are exclusively visible to the students residing in your assigned hostel, as well as to the Super Admin.
					</p>
				</details>
				
				<details class="group border rounded-lg p-3 bg-muted/20 open:bg-muted/40 transition-colors">
					<summary class="font-medium text-sm cursor-pointer select-none outline-none flex items-center justify-between">
						Can I delete a notice after posting it?
						<span class="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
					</summary>
					<p class="text-sm text-muted-foreground mt-2 leading-relaxed">
						Yes, you have full control over your hostel's Notice Board. You can delete outdated or incorrect notices directly from the Notice Board page.
					</p>
				</details>
			</CardContent>
		</Card>
	</div>
</div>
