<script lang="ts">
	/** A quiet status while page data is read. It reads nothing itself and claims no progress. */
	let { label = 'Loading…' }: { label?: string } = $props();
</script>

<div
	class="hx-loading"
	role="status"
	aria-live="polite"
	aria-atomic="true"
	data-harness-component="shared-primitives-loading-state"
>
	<span class="hx-loading-indicator" aria-hidden="true"></span>
	<span class="hx-loading-label">{label}</span>
</div>

<style>
	/* A transparent layer over the viewport that clicks pass straight through. */
	.hx-loading {
		position: fixed;
		inset: 0;
		z-index: var(--hx-layer-floating);
		display: grid;
		place-items: center;
		pointer-events: none;
		color: var(--hx-soft);
		font-size: var(--hx-type-size-sm);
		font-weight: var(--hx-style-weight-medium);
		line-height: var(--hx-style-leading-snug);
		letter-spacing: var(--hx-style-tracking-wide);
	}
	/* The ring is the only item in the grid, so its own center is the viewport's center. */
	.hx-loading-indicator {
		box-sizing: border-box;
		width: var(--hx-space-36);
		height: var(--hx-space-36);
		border: var(--hx-border-heavy) solid var(--hx-gold-soft);
		border-top-color: var(--hx-gold);
		border-left-color: var(--hx-gold-line);
		border-radius: var(--hx-radius-round);
		animation: hx-loading-turn var(--hx-motion-spin) var(--hx-motion-linear) infinite;
	}
	/* The label hangs below the ring out of flow, half the ring plus a gap down from center,
	   so a long or wrapping label never moves the ring. */
	.hx-loading-label {
		position: absolute;
		top: calc(50% + var(--hx-space-36) / 2 + var(--hx-space-16));
		right: var(--hx-gutter);
		left: var(--hx-gutter);
		text-align: center;
		overflow-wrap: anywhere;
	}
	@keyframes hx-loading-turn {
		to {
			transform: rotate(360deg);
		}
	}
	/* Without motion the ring stays still, its gold arc still marking the status. */
	@media (prefers-reduced-motion: reduce) {
		.hx-loading-indicator {
			animation: none;
		}
	}
</style>
