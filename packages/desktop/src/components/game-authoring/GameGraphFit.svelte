<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { ControlButton, useSvelteFlow } from '@xyflow/svelte';
	import { onMount } from 'svelte';
	/**
	 * Fit View for the checkpoint graph. After the library fits the nodes, the view moves to a
	 * whole-pixel pan and a 1/64 zoom step around the same centre. Every checkpoint edge then has an
	 * exact position, so a fitted checkpoint is fully visible whatever canvas size a platform's fonts
	 * and scrollbars produce. The graph is fitted this way once when it opens as well.
	 */
	const flow = useSvelteFlow();
	const limits = { minZoom: 0.1, maxZoom: 1 };
	async function fit() {
		if (!(await flow.fitView(limits))) return;
		const fitted = flow.getViewport();
		const zoom = Math.max(Math.floor(fitted.zoom * 64), Math.ceil(limits.minZoom * 64)) / 64;
		const bounds = flow.getNodesBounds(flow.getNodes());
		const shift = fitted.zoom - zoom;
		await flow.setViewport({
			x: Math.round(fitted.x + (bounds.x + bounds.width / 2) * shift),
			y: Math.round(fitted.y + (bounds.y + bounds.height / 2) * shift),
			zoom
		});
	}
	onMount(() => void fit());
</script>

<ControlButton
	class="svelte-flow__controls-fitview"
	data-harness-component="game-graph-fit"
	title="Fit View"
	aria-label="Fit View"
	onclick={fit}
>
	<hx-svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 30" aria-hidden="true">
		<hx-svg-path
			d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z"
		/>
	</hx-svg>
</ControlButton>
