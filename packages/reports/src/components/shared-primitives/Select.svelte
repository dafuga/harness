<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		value = $bindable(''),
		label,
		id,
		name,
		required,
		disabled = false,
		compact = false,
		display,
		title,
		children
	}: {
		value?: string;
		label: string;
		id?: string;
		name?: string;
		required?: boolean;
		disabled?: boolean;
		compact?: boolean;
		display?: string;
		title?: string;
		children: Snippet;
	} = $props();
	const shown = $derived(
		display && display.length > 16 ? `${display.slice(0, 6)}…${display.slice(-6)}` : display
	);
</script>

<span
	class="report-select"
	class:disabled
	class:compact
	class:has-display={display !== undefined}
	data-harness-component="select"
>
	<select bind:value aria-label={label} {id} {name} {required} {disabled} title={title ?? display}>
		{@render children()}
	</select>
	<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
		<path d="m4 6 4 4 4-4" />
	</svg>
	{#if display !== undefined}<span class="report-select-value" aria-hidden="true">{shown}</span
		>{/if}
</span>

<style>
	.report-select {
		position: relative;
		display: inline-block;
		min-width: 0;
		max-width: 100%;
	}
	/* Under its class, so no surface rule for fields or icons outranks these. */
	.report-select select {
		width: 100%;
		min-height: 44px;
		padding-inline-end: var(--hx-space-42);
		appearance: none;
		cursor: pointer;
	}
	.report-select svg {
		position: absolute;
		inset-inline-end: 14px;
		top: 50%;
		width: 16px;
		height: 16px;
		transform: translateY(-50%);
		pointer-events: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		color: var(--hx-color-text-muted);
	}
	.disabled {
		opacity: var(--hx-opacity-dim);
	}
	select:disabled {
		cursor: not-allowed;
	}

	.compact select {
		min-height: 32px;
		height: 32px;
		padding-block: 0;
		padding-inline-end: var(--hx-space-30);
	}
	.compact svg {
		inset-inline-end: 9px;
		width: 12px;
		height: 12px;
	}
	.has-display select {
		color: transparent;
	}
	.has-display :global(option) {
		color: var(--text, var(--hx-color-text));
		background: var(--hx-color-surface, var(--hx-color-surface));
	}
	.report-select-value {
		position: absolute;
		inset-inline: 12px 32px;
		top: 50%;
		transform: translateY(-50%);
		overflow: hidden;
		white-space: nowrap;
		pointer-events: none;
		font: inherit;
		color: inherit;
	}
	@media (pointer: coarse) {
		.compact select {
			min-height: 44px;
			height: 44px;
		}
	}

	@media (forced-colors: active) {
		.has-display select {
			color: CanvasText;
		}
		.report-select-value {
			display: none;
		}
		.report-select select {
			appearance: auto;
		}
		.report-select svg {
			display: none;
		}
	}
</style>
