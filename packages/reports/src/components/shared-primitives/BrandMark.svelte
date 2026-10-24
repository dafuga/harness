<!-- @harness-tier molecule -->
<!-- @harness-atoms atoms -->
<script lang="ts">
	import { brandGrid, brandTiles } from '../../utils/development-tooling/brandMark';
	/**
	 * The modular H in the colour of its text. Beside the word Harness it is decorative and
	 * hidden from assistive technology; given a label it is an image of that name.
	 */
	let { size = '1em', label = '' }: { size?: number | string; label?: string } = $props();
</script>

<hx-svg
	class="brand-tiles"
	viewBox="0 0 {brandGrid} {brandGrid}"
	width={size}
	height={size}
	fill="currentColor"
	focusable="false"
	data-brand-mark="modular-h"
	role={label ? 'img' : undefined}
	aria-label={label || undefined}
	aria-hidden={label ? undefined : 'true'}
	>{#each brandTiles as item (item.id)}<hx-svg-rect
			x={item.x}
			y={item.y}
			width={item.size}
			height={item.size}
		/>{/each}</hx-svg
>

<style>
	.brand-tiles {
		display: inline-block;
		flex: none;
		vertical-align: -0.125em;
	}
</style>
