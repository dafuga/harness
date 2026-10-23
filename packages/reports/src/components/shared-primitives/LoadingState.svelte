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
		gap: 12px;
		width: fit-content;
		max-width: 100%;
		margin: 20px 0;
		padding: 12px 16px;
		border: 1px solid var(--hx-line, #203547);
		border-radius: var(--hx-radius, 8px);
		background: var(--hx-surface, #101f2d);
		color: var(--hx-soft, #c2cadb);
		font-size: var(--hx-type-size-sm, 0.875rem);
		font-weight: var(--hx-style-weight-medium, 500);
		line-height: 1.4;
	}
	.hx-loading-indicator {
		flex: none;
		box-sizing: border-box;
		width: 16px;
		height: 16px;
		border: 2px solid var(--hx-line-strong, #2c4259);
		border-top-color: var(--hx-gold, #f3c33b);
		border-radius: 50%;
		animation: hx-loading-turn 0.9s linear infinite;
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
			gap: 10px;
			margin: 16px 0;
			padding: 10px 14px;
		}
	}
</style>
