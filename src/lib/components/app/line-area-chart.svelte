<script lang="ts">
	interface DataPoint {
		label: string;
		value: number;
	}

	interface Props {
		data: DataPoint[];
		color?: string;
		areaColor?: string;
		height?: number;
	}

	let {
		data,
		color = 'hsl(var(--primary))',
		areaColor = 'hsl(var(--primary) / 0.15)',
		height = 180
	}: Props = $props();

	const paddingLeft = 48;
	const paddingRight = 16;
	const paddingTop = 16;
	const paddingBottom = 36;
	const chartWidth = 600;

	const innerWidth = $derived(chartWidth - paddingLeft - paddingRight);
	const innerHeight = $derived(height - paddingTop - paddingBottom);

	const maxValue = $derived(Math.max(...data.map((d) => d.value), 1));

	function xAt(i: number): number {
		if (data.length <= 1) return paddingLeft + innerWidth / 2;
		return paddingLeft + (i / (data.length - 1)) * innerWidth;
	}

	function yAt(value: number): number {
		return paddingTop + innerHeight - (value / maxValue) * innerHeight;
	}

	// Build SVG path for the line
	const linePath = $derived(
		data.length === 0 ? '' : data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d.value)}`).join(' ')
	);

	// Build the filled area path
	const areaPath = $derived(
		data.length === 0 ? '' : data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d.value)}`).join(' ') + ` L ${xAt(data.length - 1)} ${paddingTop + innerHeight} L ${xAt(0)} ${paddingTop + innerHeight} Z`
	);

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
		viewBox="0 0 {chartWidth} {height}"
		width="100%"
		{height}
		role="img"
		aria-label="Line area chart"
	>
		<!-- Grid lines + Y labels -->
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

		<!-- Area fill -->
		{#if data.length > 1}
			<path d={areaPath} fill={areaColor} />
		{/if}

		<!-- Line -->
		{#if data.length > 1}
			<path d={linePath} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
		{/if}

		<!-- Data points + tooltips -->
		{#each data as d, i}
			<g class="group cursor-default">
				<circle cx={xAt(i)} cy={yAt(d.value)} r="4" fill={color} class="transition-all group-hover:r-6" />
				<!-- Value label on hover via title -->
				<title>{d.label}: {d.value}</title>
				<!-- X-axis label -->
				<text
					x={xAt(i)}
					y={paddingTop + innerHeight + 16}
					text-anchor="middle"
					font-size="10"
					fill="currentColor"
					opacity="0.6"
				>
					{d.label}
				</text>
			</g>
		{/each}

		<!-- X-axis baseline -->
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
