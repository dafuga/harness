<script lang="ts">
	import type { Measure } from '../models/Desktop.types';
	let { size, performance }: { size: Measure; performance: Measure } = $props();
</script>

<!-- A measure that was not taken says so; nothing is estimated here. -->
<section class="panel measures-panel">
	<h2>Size &amp; performance</h2>
	<dl>
		<dt>Size</dt>
		<dd class:measured={size.available}>{size.text || 'Not measured'}</dd>
		<dt>Performance</dt>
		<dd class:measured={performance.available}>{performance.text || 'Not measured'}</dd>
	</dl>
</section>
