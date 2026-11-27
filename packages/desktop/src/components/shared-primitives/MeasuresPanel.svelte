<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_ttl26nd5p5 -->
<script lang="ts">
	import type { MeasuresPanelRow } from './MeasuresPanel.types';
	import DetailList from '$shared/shared-primitives/DetailList.svelte';
	import type { Measure } from '../../models/development-tooling/Desktop.types';
	let { size, performance }: { size: Measure; performance: Measure } = $props();
</script>

<!-- A measure that was not taken says so; nothing is estimated here. -->
<hx-section class="panel measures-panel">
	<hx-h2>Size &amp; performance</hx-h2>
	<DetailList
		rows={[
			{ name: 'Size', measure: size },
			{ name: 'Performance', measure: performance }
		]}
		rowKey={(row) => row.name}
		grouped={false}
		valueClass={(row) => (row.measure.available ? 'measured' : '')}
	>
		{#snippet label(row: MeasuresPanelRow)}{row.name}{/snippet}
		{#snippet children(row: MeasuresPanelRow)}{row.measure.text || 'Not measured'}{/snippet}
	</DetailList>
</hx-section>
