<script lang="ts">
	interface Segment {
		label: string;
		value: number;
		color: string;
	}

	interface Props {
		segments: Segment[];
		size?: number;
	}

	let { segments, size = 160 }: Props = $props();

	const total = $derived(segments.reduce((s, d) => s + d.value, 0));
	const cx = $derived(size / 2);
	const cy = $derived(size / 2);
	const r = $derived(size * 0.38); // outer radius
	const inner = $derived(size * 0.22); // inner (hole)

	interface Arc {
		d: string;
		color: string;
		label: string;
		value: number;
		pct: number;
	}

	const arcs = $derived((() => {
		if (total === 0) return [];
		const result: Arc[] = [];
		let start = -Math.PI / 2; // start from top

		for (const seg of segments) {
			if (seg.value === 0) continue;
			const pct = seg.value / total;
			const angle = pct * 2 * Math.PI;
			const end = start + angle;

			const x1 = cx + r * Math.cos(start);
			const y1 = cy + r * Math.sin(start);
			const x2 = cx + r * Math.cos(end);
			const y2 = cy + r * Math.sin(end);
			const ix1 = cx + inner * Math.cos(start);
			const iy1 = cy + inner * Math.sin(start);
			const ix2 = cx + inner * Math.cos(end);
			const iy2 = cy + inner * Math.sin(end);
			const largeArc = angle > Math.PI ? 1 : 0;

			const d = [
				`M ${x1} ${y1}`,
				`A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
				`L ${ix2} ${iy2}`,
				`A ${inner} ${inner} 0 ${largeArc} 0 ${ix1} ${iy1}`,
				'Z'
			].join(' ');

			result.push({ d, color: seg.color, label: seg.label, value: seg.value, pct });
			start = end;
		}
		return result;
	})());
</script>

<div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
	<!-- Donut SVG -->
	<div class="shrink-0">
		<svg width={size} height={size} viewBox="0 0 {size} {size}" role="img" aria-label="Donut chart">
			{#if total === 0}
				<!-- Empty state ring -->
				<circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" stroke-opacity="0.1" stroke-width={r - inner} />
				<text x={cx} y={cy + 4} text-anchor="middle" font-size="12" fill="currentColor" opacity="0.4">No data</text>
			{:else}
				{#each arcs as arc}
					<path d={arc.d} fill={arc.color} class="transition-opacity hover:opacity-80 cursor-default" />
				{/each}
				<!-- Center label -->
				<text x={cx} y={cy - 6} text-anchor="middle" font-size="18" font-weight="700" fill="currentColor">{total}</text>
				<text x={cx} y={cy + 10} text-anchor="middle" font-size="9" fill="currentColor" opacity="0.5">TOTAL</text>
			{/if}
		</svg>
	</div>

	<!-- Legend -->
	<ul class="space-y-1.5 py-1 text-sm min-w-0">
		{#each segments as seg}
			{#if seg.value > 0}
				<li class="flex items-center gap-2">
					<span class="size-2.5 shrink-0 rounded-full" style="background:{seg.color}"></span>
					<span class="truncate text-muted-foreground">{seg.label}</span>
					<span class="ml-auto font-semibold tabular-nums pl-2">{seg.value}</span>
					{#if total > 0}
						<span class="text-muted-foreground text-xs w-9 text-right">{Math.round((seg.value / total) * 100)}%</span>
					{/if}
				</li>
			{/if}
		{/each}
	</ul>
</div>
