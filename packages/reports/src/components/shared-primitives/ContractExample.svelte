<!-- @harness-tier organism -->
<!-- @harness-atoms atoms -->
<!-- @harness-uid u_z3fe2l5db4 -->
<script lang="ts">
	import DetailList from './DetailList.svelte';
	import type {
		ContractExample as Example,
		ContractField
	} from '../../utils/explorer-ui/contractFields';
	import RecordedValue from './recorded-value/RecordedValue.svelte';
	/** One field of a contract as its example view says it: what it is, then what it looks like. */
	let { field }: { field: ContractField } = $props();
	// Where the examples come from; none of them is the result of a test.
	const sources = {
		declared: 'Written in the contract. Not the result of a test.',
		illustrative: 'A placeholder shaped by the type alone. Not the result of a test.',
		missing: 'The contract declares none, and the type is not plain data a placeholder can show.'
	} as const;
</script>

{#snippet example(item: Example)}
	{#if item.form === 'structure'}
		<RecordedValue value={item.value} />
		<hx-details class="whole">
			<hx-summary>Full example as JSON</hx-summary>
			<hx-pre class="literal">{item.text}</hx-pre>
		</hx-details>
	{:else if item.form === 'markup'}
		<hx-pre class="literal">{item.text}</hx-pre>
	{:else}
		<hx-code class="literal">{item.text}</hx-code>
	{/if}
{/snippet}

<hx-div class="contract-example" data-harness-component="contract-example">
	<DetailList
		rows={['Type', 'Description']}
		rowKey={(name) => name}
		className="about"
		valueClass={(name) => (name === 'Description' && !field.description ? 'none' : '')}
	>
		{#snippet label(name)}{name}{/snippet}
		{#snippet children(name)}
			{#if name === 'Type'}<hx-code class="type">{field.type}</hx-code>
			{:else}{field.description ?? 'No description recorded.'}{/if}
		{/snippet}
	</DetailList>
	<hx-div class="examples">
		<hx-h3>
			{#if field.source === 'missing'}
				Example not recorded
			{:else}
				<hx-span class={field.source}
					>{field.source === 'declared' ? 'Declared' : 'Illustrative'}</hx-span
				>
				{field.examples.length > 1 ? 'examples' : 'example'}
			{/if}
		</hx-h3>
		<hx-p class="note">{sources[field.source]}</hx-p>
		{#if field.examples.length > 0}
			<hx-ul>
				{#each field.examples as item, at (at)}<hx-li>{@render example(item)}</hx-li>{/each}
			</hx-ul>
		{/if}
	</hx-div>
</hx-div>

<style>
	.contract-example {
		display: grid;
		gap: var(--hx-space-18);
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.contract-example :global(.about) {
		display: grid;
		gap: var(--hx-space-10);
		margin: 0;
	}
	.contract-example :global(.about > div) {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr);
		align-items: baseline;
		gap: var(--hx-space-4) var(--hx-space-12);
	}
	.contract-example :global(dt) {
		color: var(--hx-color-text-supporting);
		font-size: var(--hx-type-size-sm);
	}
	.contract-example :global(dd) {
		min-width: 0;
		margin: 0;
	}
	.contract-example :global(.none),
	.note {
		color: var(--hx-color-text-supporting);
	}
	.type {
		padding: var(--hx-space-2) var(--hx-space-8);
		border: var(--hx-border-thin) solid color-mix(in srgb, var(--hx-color-primary) 45%, transparent);
		border-radius: var(--hx-radius-compact);
		color: var(--hx-color-primary);
		font-size: var(--hx-type-size-sm);
	}
	.examples {
		display: grid;
		gap: var(--hx-space-10);
		min-width: 0;
		padding-top: var(--hx-space-14);
		border-top: var(--hx-border-thin) solid var(--hx-color-border);
	}
	h3 {
		margin: 0;
		font-size: var(--hx-type-size-base);
		font-weight: var(--hx-style-weight-semibold);
	}
	.declared {
		color: var(--hx-color-primary);
	}
	.illustrative {
		font-style: var(--hx-style-font-italic);
	}
	.note {
		margin: 0;
		font-size: var(--hx-type-size-sm);
	}
	ul {
		display: grid;
		gap: var(--hx-space-10);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		min-width: 0;
	}
	/* Long values wrap inside the dialog; the shared dialog bounds the height of preformatted text. */
	.literal {
		display: block;
		margin: 0;
		padding: var(--hx-space-8) var(--hx-space-10);
		border-radius: var(--hx-radius-compact);
		background: var(--hx-color-surface-raised);
		font: var(--hx-style-code);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.whole {
		margin-top: var(--hx-space-8);
	}
	.whole summary {
		color: var(--hx-color-primary);
		font-size: var(--hx-type-size-sm);
		cursor: pointer;
	}
	.whole summary:focus-visible {
		border-radius: var(--hx-radius-xsmall);
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
		outline-offset: var(--hx-border-thick);
	}
	.whole .literal {
		margin-top: var(--hx-space-6);
	}
	@media (max-width: 480px) {
		.contract-example :global(.about > div) {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
