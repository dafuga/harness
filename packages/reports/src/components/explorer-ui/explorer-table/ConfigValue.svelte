<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { ConfigValueNode } from '../../../../../../src/utils/explorer-ui/unitMetadata';
	import { collection, valueMark } from '../ConfigValueTree.svelte';
	import HarnessAction from '../HarnessAction.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
	let {
		name,
		source,
		literal,
		structure,
		onview
	}: {
		name: string;
		/** The initializer exactly as committed; never executed. */
		source: string;
		literal?: unknown;
		structure?: ConfigValueNode;
		onview: (event: MouseEvent) => void;
	} = $props();
	const scalar = (item: unknown) =>
		item === null || ['string', 'number', 'boolean'].includes(typeof item);
	const shown = (item: unknown) => (item === '' ? 'Empty string' : String(item));
	let items = $derived(
		Array.isArray(literal) &&
			literal.length <= 10 &&
			literal.every(scalar) &&
			literal.map(shown).join('').length <= 96
			? literal
			: null
	);
	let mark = $derived(collection(structure) ? valueMark(structure, source) : undefined);
</script>

<hx-div class="cv" data-harness-part="config-value">
	{#if mark}
		<hx-span class="inspect">
			<HarnessAction tone="plain" label={`View value for ${name}`} onclick={onview}>
				<HarnessIcon name={mark.icon} size={18} />
			</HarnessAction>
			<hx-span class="ex-note">{mark.size}</hx-span>
		</hx-span>
	{/if}
	{#if typeof literal === 'boolean'}
		<hx-span class="pill" class:on={literal} role="img" aria-label={`Boolean ${literal}`}
			><HarnessIcon name={literal ? 'passed' : 'failed'} size={14} />{String(literal)}</hx-span
		>
	{:else if typeof literal === 'number'}
		<hx-span class="number" role="img" aria-label={`Number ${literal}`}>{literal}</hx-span>
	{:else if literal === null}
		<hx-span class="keyword" role="img" aria-label="Null">null</hx-span>
	{:else if literal === ''}
		<hx-span class="chip blank" role="img" aria-label="Empty string">Empty string</hx-span>
	{:else if items}
		<hx-ul
			class="items"
			aria-label={`Array, ${items.length} ${items.length === 1 ? 'item' : 'items'}`}
		>
			{#each items as item, position (position)}
				<hx-li
					class="chip"
					class:number={typeof item === 'number'}
					class:keyword={item === null || typeof item === 'boolean'}
					class:blank={item === ''}
				>
					{shown(item)}
				</hx-li>
			{:else}<hx-li class="chip blank">Empty array</hx-li>{/each}
		</hx-ul>
	{:else if typeof literal === 'string'}
		<hx-span class="string" role="img" aria-label={`String ${literal}`}>{literal}</hx-span>
	{:else if !mark}<hx-code class="source" title={source}>{source}</hx-code>{/if}
</hx-div>

<style>
	/* One value in its cell: a typed mark for a literal, the text as written for an expression. */
	.cv {
		contain: inline-size;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-6) var(--hx-space-12);
		min-width: 0;
		line-height: var(--hx-style-leading-normal);
	}
	.inspect {
		display: inline-flex;
		align-items: center;
		gap: var(--hx-space-10);
	}
	.inspect :global(.hx-action) {
		width: 44px;
		padding: 0;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: var(--hx-space-6);
		padding: 0 var(--hx-space-10) 0 var(--hx-space-6);
		border: var(--hx-border-thin) solid var(--ex-line-strong);
		border-radius: var(--hx-radius-pill);
		background: var(--ex-raised);
		color: var(--ex-soft);
		font-family: var(--hx-font-family-code);
		font-size: var(--hx-type-size-sm);
	}
	.pill :global(.hx-icon) {
		color: var(--ex-muted);
	}
	.pill.on {
		border-color: color-mix(in srgb, var(--ex-pass) 45%, transparent);
		background: color-mix(in srgb, var(--ex-pass) 12%, transparent);
		color: var(--ex-pass);
	}
	.pill.on :global(.hx-icon) {
		color: inherit;
	}
	/* The items of a short list, each a chip that keeps the mark of its own type. */
	.items {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hx-space-6);
		min-width: 0;
	}
	.chip {
		padding: 0 var(--hx-space-8);
		border: var(--hx-border-thin) solid var(--ex-line-strong);
		border-radius: var(--hx-radius-small);
		background: var(--ex-raised);
		color: var(--ex-text);
		font-size: var(--hx-type-size-sm);
		overflow-wrap: anywhere;
	}
	.chip.blank {
		border-style: dashed;
		background: transparent;
		color: var(--ex-muted);
		font-style: var(--hx-style-font-italic);
	}
	.number,
	.keyword,
	.source {
		font-family: var(--hx-font-family-code);
		font-size: var(--hx-type-size-sm);
	}
	.number {
		color: var(--hx-color-info);
		font-variant-numeric: var(--hx-style-numeric-tabular);
	}
	.keyword {
		color: var(--ex-muted);
	}
	.string,
	.source {
		color: var(--ex-text);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.string,
	.source {
		min-width: 0;
	}
	.source {
		color: var(--ex-soft);
	}
</style>
