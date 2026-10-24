<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { HarnessGroupProps } from './HarnessGroup.types';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		title,
		count,
		icon,
		source,
		description,
		level = 2,
		variant = 'catalog',
		resetKey = '',
		children
	}: HarnessGroupProps = $props();
	const id = $props.id();
	let expanded = $state(true);
	let previous = $state<string>();
	$effect(() => {
		if (previous !== resetKey) {
			previous = resetKey;
			expanded = true;
		}
	});
</script>

<hx-section
	class="hx-module-group {variant}"
	aria-labelledby={`${id}-heading`}
	data-harness-component="explorer-ui-harness-group"
>
	<hx-element this={level === 3 ? 'h3' : 'h2'} id={`${id}-heading`} title={source}>
		<hx-button
			type="button"
			aria-expanded={expanded}
			aria-controls={`${id}-body`}
			onclick={() => (expanded = !expanded)}
		>
			<HarnessIcon name={expanded ? 'chevron-down' : 'chevron-right'} size={18} />
			{#if icon}<HarnessIcon name={icon} size={18} />{/if}
			<hx-span class="hx-group-title">{title}</hx-span>
			<hx-span class="hx-group-count">{count}</hx-span>
		</hx-button>
	</hx-element>
	<hx-div id={`${id}-body`} hidden={!expanded}>
		{#if description}<hx-p class="ex-soft">{description}</hx-p>{/if}
		{@render children()}
	</hx-div>
</hx-section>

<style>
	.hx-module-group {
		min-width: 0;
	}
	h2,
	h3 {
		margin: 0 0 var(--hx-space-12);
		font-size: var(--hx-type-size-lg);
		line-height: var(--hx-style-leading-snug);
	}
	h3 {
		font-size: var(--hx-type-size-base);
	}
	.relation {
		margin-top: var(--hx-space-20);
	}
	.styles h2 {
		font-family: var(--hx-font-family-heading);
		font-size: var(--hx-type-size-heading);
	}
	button {
		display: flex;
		align-items: center;
		gap: var(--hx-space-8);
		width: 100%;
		min-height: var(--hx-space-48);
		padding: var(--hx-space-8) 0;
		border: 0;
		border-bottom: var(--hx-border-thin) solid var(--hx-color-border);
		background: transparent;
		color: var(--hx-color-text);
		text-align: start;
		font: inherit;
		font-weight: var(--hx-style-weight-semibold);
		cursor: pointer;
	}
	button:hover {
		background: var(--hx-color-hover);
	}
	button:focus-visible {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
		outline-offset: var(--hx-space-2);
		border-radius: var(--hx-radius-small);
	}
	.hx-group-title {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.hx-group-count {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-compact);
		font-weight: var(--hx-style-weight-regular);
		font-variant-numeric: var(--hx-style-numeric-tabular);
		white-space: nowrap;
	}
	[hidden] {
		display: none;
	}
</style>
