<script lang="ts">
	import { getSlaStatus } from '$lib/sla';
	import type { SlaVariant } from '$lib/sla';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';

	interface Props {
		priority: string;
		createdAt: string;
		status: string;
		/** Show compact mode (just icon + short text, no deadline line) */
		compact?: boolean;
	}

	let { priority, createdAt, status, compact = false }: Props = $props();

	const sla = $derived(getSlaStatus(priority, createdAt, status));

	const variantClasses: Record<SlaVariant, string> = {
		resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
		'on-track': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800',
		'at-risk': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
		overdue: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'
	};
</script>

<span
	class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium {variantClasses[sla.variant]}"
	title="SLA deadline: {new Date(sla.deadlineIso).toLocaleString()}"
>
	{#if sla.variant === 'resolved'}
		<CheckCircle2Icon class="size-3 shrink-0" />
	{:else if sla.variant === 'overdue'}
		<CircleAlertIcon class="size-3 shrink-0" />
	{:else if sla.variant === 'at-risk'}
		<AlertTriangleIcon class="size-3 shrink-0" />
	{:else}
		<ClockIcon class="size-3 shrink-0" />
	{/if}
	<span>{sla.label}</span>
</span>
