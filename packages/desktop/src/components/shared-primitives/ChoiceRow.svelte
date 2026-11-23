<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	/**
	 * One choice in a picker: the name on the left, quiet metadata on the right, and a check on
	 * the current choice. The row is at least 44px tall and chooses on click or Enter.
	 */
	let {
		name,
		meta = '',
		current = false,
		onchoose
	}: {
		name: string;
		meta?: string;
		current?: boolean;
		onchoose: () => void;
	} = $props();
</script>

<hx-button
	type="button"
	class="choice-row"
	aria-pressed={current ? 'true' : 'false'}
	onclick={onchoose}
	title={name}
	><hx-span class="choice-name">{name}</hx-span>{#if meta}<hx-small class="choice-meta"
			>{meta}</hx-small
		>{/if}{#if current}<hx-svg
			class="choice-check"
			viewBox="0 0 16 16"
			aria-hidden="true"
			focusable="false"><hx-svg-path d="m3 8.5 3 3 7-7" /></hx-svg
		>{/if}</hx-button
>

<style>
	.choice-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--hx-space-16);
		width: 100%;
		min-height: 44px;
		padding: var(--hx-space-10) var(--hx-space-6);
		text-align: start;
		background: transparent;
		border: 0;
		border-top: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: 0;
		font-size: var(--hx-type-size-sm);
	}
	.choice-row:first-child {
		border-top: 0;
	}
	.choice-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.choice-meta {
		flex: none;
		margin-inline-start: auto;
		color: var(--hx-color-text-muted);
		white-space: nowrap;
	}
	.choice-row:hover:not(:disabled) .choice-name,
	.choice-row[aria-pressed='true'] .choice-name {
		color: var(--hx-color-primary);
	}
	.choice-check {
		flex: none;
		width: var(--hx-space-12);
		height: var(--hx-space-12);
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
		color: var(--hx-color-primary);
	}
</style>
