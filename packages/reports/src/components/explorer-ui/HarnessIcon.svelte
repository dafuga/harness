<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import {
		harnessIcons,
		solidIcons,
		type HarnessIconName
	} from '../../utils/explorer-ui/harnessIcons';
	let {
		name,
		size = 20,
		label
	}: {
		name: HarnessIconName;
		/** The side of the square it is drawn in, in pixels. */
		size?: number;
		/** The name of an icon that stands alone; beside words it has none and is not read out. */
		label?: string;
	} = $props();
</script>

<hx-svg
	class="hx-icon"
	class:solid={solidIcons.has(name)}
	data-harness-component="harness-harness-icon"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	focusable="false"><hx-svg-path d={harnessIcons[name]} /></hx-svg
>

<style>
	.hx-icon {
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	/* A verdict is a disc with its mark cut out, so the mark is whatever lies behind it. */
	.hx-icon.solid {
		fill: currentColor;
		fill-rule: evenodd;
		stroke: none;
	}
</style>
