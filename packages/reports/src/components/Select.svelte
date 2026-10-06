<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		value = $bindable(''),
		label,
		name,
		disabled = false,
		children
	}: {
		value?: string;
		label: string;
		name?: string;
		disabled?: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="report-select" class:disabled>
	<select bind:value aria-label={label} {name} {disabled}>
		{@render children()}
	</select>
	<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
		<path d="m4 6 4 4 4-4" />
	</svg>
</div>

<style>
	.report-select {
		position: relative;
		display: inline-block;
		min-width: 0;
		max-width: 100%;
	}
	select {
		width: 100%;
		min-height: 44px;
		padding-inline-end: 42px;
		appearance: none;
		cursor: pointer;
	}
	svg {
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
		color: var(--muted);
	}
	.disabled {
		opacity: 0.5;
	}
	select:disabled {
		cursor: not-allowed;
	}
	@media (forced-colors: active) {
		select {
			appearance: auto;
		}
		svg {
			display: none;
		}
	}
</style>
