<script lang="ts">
	import type { ContractExample as Example, ContractField } from '../utils/contractFields';
	import RecordedValue from './RecordedValue.svelte';
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
		<details class="whole">
			<summary>Full example as JSON</summary>
			<pre class="literal">{item.text}</pre>
		</details>
	{:else if item.form === 'markup'}
		<pre class="literal">{item.text}</pre>
	{:else}
		<code class="literal">{item.text}</code>
	{/if}
{/snippet}

<div class="contract-example" data-harness-component="contract-example">
	<dl class="about">
		<div>
			<dt>Type</dt>
			<dd><code class="type">{field.type}</code></dd>
		</div>
		<div>
			<dt>Description</dt>
			<dd class:none={!field.description}>{field.description ?? 'No description recorded.'}</dd>
		</div>
	</dl>
	<div class="examples">
		<h3>
			{#if field.source === 'missing'}
				Example not recorded
			{:else}
				<span class={field.source}>{field.source === 'declared' ? 'Declared' : 'Illustrative'}</span
				>
				{field.examples.length > 1 ? 'examples' : 'example'}
			{/if}
		</h3>
		<p class="note">{sources[field.source]}</p>
		{#if field.examples.length > 0}
			<ul>
				{#each field.examples as item, at (at)}<li>{@render example(item)}</li>{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.contract-example {
		display: grid;
		gap: 18px;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.about {
		display: grid;
		gap: 10px;
		margin: 0;
	}
	.about > div {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr);
		align-items: baseline;
		gap: 4px 12px;
	}
	dt {
		color: var(--ex-soft);
		font-size: 0.85rem;
	}
	dd {
		min-width: 0;
		margin: 0;
	}
	.none,
	.note {
		color: var(--ex-soft);
	}
	.type {
		padding: 2px 8px;
		border: 1px solid color-mix(in srgb, var(--ex-gold) 45%, transparent);
		border-radius: 6px;
		color: var(--ex-gold);
		font-size: 0.88rem;
	}
	.examples {
		display: grid;
		gap: 10px;
		min-width: 0;
		padding-top: 14px;
		border-top: 1px solid var(--ex-line);
	}
	h3 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}
	.declared {
		color: var(--ex-gold);
	}
	.illustrative {
		font-style: italic;
	}
	.note {
		margin: 0;
		font-size: 0.85rem;
	}
	ul {
		display: grid;
		gap: 10px;
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
		padding: 8px 10px;
		border-radius: 6px;
		background: var(--ex-raised);
		font:
			0.88rem/1.5 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.whole {
		margin-top: 8px;
	}
	.whole summary {
		color: var(--ex-gold);
		font-size: 0.85rem;
		cursor: pointer;
	}
	.whole summary:focus-visible {
		border-radius: 4px;
		outline: 2px solid var(--ex-gold);
		outline-offset: 2px;
	}
	.whole .literal {
		margin-top: 6px;
	}
	@media (max-width: 480px) {
		.about > div {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
