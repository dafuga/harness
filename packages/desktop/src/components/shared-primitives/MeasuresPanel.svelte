<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Measure } from '../../models/development-tooling/Desktop.types';
	let { size, performance }: { size: Measure; performance: Measure } = $props();
</script>

<!-- A measure that was not taken says so; nothing is estimated here. -->
<hx-section class="panel measures-panel">
	<hx-h2>Size &amp; performance</hx-h2>
	<hx-dl>
		<hx-dt>Size</hx-dt>
		<hx-dd class:measured={size.available}>{size.text || 'Not measured'}</hx-dd>
		<hx-dt>Performance</hx-dt>
		<hx-dd class:measured={performance.available}>{performance.text || 'Not measured'}</hx-dd>
	</hx-dl>
</hx-section>
