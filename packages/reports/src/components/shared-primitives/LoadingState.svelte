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
	.hx-loading {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--hx-space-12);
		width: fit-content;
		max-width: 100%;
		margin: var(--hx-space-20) 0;
		padding: var(--hx-space-12) var(--hx-space-16);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius);
		background: var(--hx-color-surface);
		color: var(--hx-color-text-supporting);
		font-size: var(--hx-type-size-sm);
		font-weight: var(--hx-style-weight-medium);
		line-height: var(--hx-style-leading-snug);
	}
	.hx-loading-indicator {
		flex: none;
		box-sizing: border-box;
		width: 16px;
		height: 16px;
		border: var(--hx-border-thick) solid var(--hx-color-border-strong);
		border-top-color: var(--hx-color-primary);
		border-radius: var(--hx-radius-round);
		animation: hx-loading-turn var(--hx-motion-spin) var(--hx-motion-linear) infinite;
	}
	.hx-loading-label {
		min-width: 0;
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
	@media (max-width: 560px) {
		.hx-loading {
			gap: var(--hx-space-10);
			margin: var(--hx-space-16) 0;
			padding: var(--hx-space-10) var(--hx-space-14);
		}
	}
</style>
