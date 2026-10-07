<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '../utils/reportLocale';
	import { imageAnchor, keepPointerInPlace, trackpadZoom } from '../utils/trackpadZoom';
	type Point = { x: number; y: number };
	type DragStart = Point & { left: number; top: number };
	let { src, alt }: { src: string; alt: string } = $props();

	// Scales are multiples of the image's natural pixels; null means fitted to the viewer.
	const STEPS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4];
	const MAX_SCALE = STEPS[STEPS.length - 1];
	const EPSILON = 0.01;
	let image = $state<HTMLImageElement>();
	let stage = $state<HTMLDivElement>();
	let scale = $state<number | null>(null);
	let naturalWidth = $state(0);
	let renderedWidth = $state(0);
	let drag = $state<DragStart | null>(null);
	let fitScale = 1;
	let zoomed = $derived(scale !== null);
	let current = $derived(scale ?? (naturalWidth ? renderedWidth / naturalWidth : 1));
	let percent = $derived(naturalWidth ? `${Math.round(current * 100)}%` : '–');
	function viewCenter(element: HTMLElement): Point {
		return {
			x: (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth,
			y: (element.scrollTop + element.clientHeight / 2) / element.scrollHeight
		};
	}
	function centerOn(element: HTMLElement, point: Point) {
		element.scrollLeft = point.x * element.scrollWidth - element.clientWidth / 2;
		element.scrollTop = point.y * element.scrollHeight - element.clientHeight / 2;
	}
	async function zoomTo(next: number | null, pointer?: Point) {
		const viewport = stage;
		if (!viewport || !image?.naturalWidth) return;
		const anchor = pointer ? imageAnchor(image, pointer) : zoomed ? viewCenter(viewport) : null;
		if (!zoomed) fitScale = image.clientWidth / image.naturalWidth;
		naturalWidth = image.naturalWidth;
		scale = next;
		await tick();
		if (anchor && next !== null) {
			if (pointer) keepPointerInPlace(viewport, image, anchor, pointer);
			else centerOn(viewport, anchor);
		}
	}
	function zoomIn() {
		const next = STEPS.find((step) => step > current + EPSILON);
		if (next) void zoomTo(next);
	}
	function zoomOut() {
		const from = scale;
		if (from === null) return;
		const next = STEPS.filter((step) => step < from - EPSILON).pop();
		void zoomTo(next && next > fitScale + EPSILON ? next : null);
	}
	// Fit comes from layout because bind:clientWidth lags a frame behind quick pinch bursts.
	function pinchControls() {
		if (!image?.naturalWidth) return null;
		const fitted = scale === null ? image.clientWidth / image.naturalWidth : fitScale;
		return { current: scale ?? fitted, minimum: fitted, maximum: MAX_SCALE, apply: zoomTo };
	}
	function startDrag(event: PointerEvent) {
		if (!zoomed || !stage || event.target !== image) return;
		if (event.pointerType !== 'mouse' || event.button !== 0) return;
		drag = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
		stage.setPointerCapture(event.pointerId);
		event.preventDefault();
	}
	function moveDrag(event: PointerEvent) {
		if (!drag || !stage) return;
		stage.scrollLeft = drag.left - (event.clientX - drag.x);
		stage.scrollTop = drag.top - (event.clientY - drag.y);
	}
	function endDrag() {
		drag = null;
	}
	function keepArrowsForPanning(event: KeyboardEvent) {
		const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
		if (horizontal && stage && stage.scrollWidth > stage.clientWidth) event.stopPropagation();
	}
</script>

<div class="zoom" data-harness-component="image-zoom">
	<div class="zoom-bar" role="group" aria-label={$t('zoomControls')}>
		<button
			class="step"
			aria-label={$t('zoomOut')}
			title={$t('zoomOut')}
			aria-disabled={!zoomed}
			onclick={zoomOut}>−</button
		>
		<output class="scale">{percent}</output>
		<button
			class="step"
			aria-label={$t('zoomIn')}
			title={$t('zoomIn')}
			aria-disabled={current >= MAX_SCALE - EPSILON}
			onclick={zoomIn}>+</button
		>
		<button class:active={scale === 1} aria-pressed={scale === 1} onclick={() => zoomTo(1)}
			>{$t('actualSize')}</button
		>
		<button class:active={!zoomed} aria-pressed={!zoomed} onclick={() => zoomTo(null)}
			>{$t('fitImage')}</button
		>
	</div>
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions focusable so keyboards can pan -->
	<div
		bind:this={stage}
		use:trackpadZoom={pinchControls}
		class="stage"
		class:zoomed
		class:dragging={drag !== null}
		role={zoomed ? 'region' : undefined}
		aria-label={zoomed ? $t('panImage') : undefined}
		tabindex={zoomed ? 0 : undefined}
		onkeydown={keepArrowsForPanning}
		onpointerdown={startDrag}
		onpointermove={moveDrag}
		onpointerup={endDrag}
		onpointercancel={endDrag}
	>
		<img
			bind:this={image}
			bind:clientWidth={renderedWidth}
			{src}
			{alt}
			draggable="false"
			style:width={scale === null ? null : `${naturalWidth * scale}px`}
			onload={() => (naturalWidth = image?.naturalWidth ?? 0)}
		/>
	</div>
</div>

<style>
	.zoom {
		--view-height: max(320px, calc(100dvh - 340px));
	}
	.zoom-bar {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding-bottom: 8px;
		background: #070d18;
	}
	.zoom-bar button {
		min-height: 36px;
		padding: 6px 12px;
		font-size: 13px;
		line-height: 1.2;
	}
	.zoom-bar .step {
		min-width: 40px;
		padding: 4px 10px;
		font-size: 18px;
	}
	.zoom-bar .active {
		border-color: var(--gold);
		background: var(--gold);
		color: #161e22;
	}
	.zoom-bar [aria-disabled='true'] {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.scale {
		min-width: 4.5ch;
		color: #e6edf5;
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.stage img {
		max-height: var(--view-height);
	}
	.stage.zoomed {
		max-height: var(--view-height);
		overflow: auto;
		overscroll-behavior: contain;
		border: 1px solid #223050;
		border-radius: 8px;
		background: #0a1220;
		cursor: grab;
		scrollbar-color: #3d5078 transparent;
	}
	.stage.zoomed img {
		max-width: none;
		max-height: none;
	}
	.stage.dragging {
		cursor: grabbing;
		user-select: none;
	}
	.stage:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: -2px;
	}
	@media (max-width: 650px) {
		.zoom {
			--view-height: max(320px, calc(100dvh - 132px));
		}
		.zoom-bar {
			gap: 4px;
		}
		.zoom-bar button {
			min-height: 44px;
			padding: 6px 10px;
		}
		.zoom-bar .step {
			min-width: 44px;
		}
	}
</style>
