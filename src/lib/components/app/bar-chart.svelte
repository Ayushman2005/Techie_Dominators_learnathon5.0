<script lang="ts">
	interface DataPoint {
		label: string;
		value: number;
	}

	interface Props {
		data: DataPoint[];
		color?: string;
		height?: number;
	}

	let { data, color = 'hsl(var(--primary))', height = 200 }: Props = $props();

	const paddingLeft = 48;
	const paddingRight = 16;
	const paddingTop = 16;
	const paddingBottom = 36;

	const maxValue = $derived(Math.max(...data.map((d) => d.value), 1));

	const chartWidth = $derived(600); // intrinsic — scales via viewBox
	const chartHeight = $derived(height);
	const innerWidth = $derived(chartWidth - paddingLeft - paddingRight);
	const innerHeight = $derived(chartHeight - paddingTop - paddingBottom);

	const barWidth = $derived(data.length > 0 ? innerWidth / data.length : 0);
	const barPad = $derived(barWidth * 0.2);

	function barH(value: number): number {
		return (value / maxValue) * innerHeight;
	}
	function barY(value: number): number {
		return paddingTop + innerHeight - barH(value);
	}

	// Y-axis ticks: Ensure unique integer values to prevent duplicate labels on small ranges
	const yTicks = $derived(
		Array.from(new Set([0, 0.25, 0.5, 0.75, 1].map((pct) => Math.round(maxValue * pct)))).map((val) => ({
			value: val,
			y: paddingTop + innerHeight - (val / maxValue) * innerHeight
		}))
	);
</script>

<div class="w-full overflow-x-auto">
	<svg
		viewBox="0 0 {chartWidth} {chartHeight}"
		width="100%"
		height={chartHeight}
		role="img"
		aria-label="Bar chart"
	>
		<!-- Y-axis grid lines and labels -->
		{#each yTicks as tick}
			<line
				x1={paddingLeft}
				y1={tick.y}
				x2={chartWidth - paddingRight}
				y2={tick.y}
				stroke="currentColor"
				stroke-opacity="0.08"
				stroke-dasharray="4 3"
			/>
			<text
				x={paddingLeft - 6}
				y={tick.y + 4}
				text-anchor="end"
				font-size="10"
				fill="currentColor"
				opacity="0.5">{tick.value}</text
			>
		{/each}

		<!-- Bars -->
		{#each data as d, i}
			{@const maxBw = 80}
			{@const bw = Math.min(barWidth - barPad, maxBw)}
			{@const slotCenter = paddingLeft + i * barWidth + barWidth / 2}
			{@const bx = slotCenter - bw / 2}
			{@const bh = barH(d.value)}
			{@const by = barY(d.value)}

			<!-- Bar shadow / hover group -->
			<g class="group cursor-default">
				<rect
					x={bx}
					y={by}
					width={bw}
					height={bh}
					rx="3"
					fill={color}
					opacity="0.85"
					class="transition-opacity group-hover:opacity-100"
				/>
				<!-- Value label on top -->
				{#if d.value > 0}
					<text
						x={slotCenter}
						y={by - 4}
						text-anchor="middle"
						font-size="10"
						font-weight="600"
						fill="currentColor"
						opacity="0.7"
					>
						{d.value}
					</text>
				{/if}
				<!-- X label -->
				<text
					x={slotCenter}
					y={paddingTop + innerHeight + 16}
					text-anchor="middle"
					font-size="10"
					fill="currentColor"
					opacity="0.6"
				>
					{d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}
				</text>
			</g>
		{/each}

		<!-- X axis line -->
		<line
			x1={paddingLeft}
			y1={paddingTop + innerHeight}
			x2={chartWidth - paddingRight}
			y2={paddingTop + innerHeight}
			stroke="currentColor"
			stroke-opacity="0.15"
		/>
	</svg>
</div>
