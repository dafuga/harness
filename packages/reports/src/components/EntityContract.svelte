<script lang="ts">
	import type { ExplorerCategory } from '../models/Explorer.types';
	import type { HarnessUnit } from '../models/Harness.types';
	import type { ContractRow } from '../utils/entityContract';
	import { contractFacts, contractFields, type ContractExample } from '../utils/contractFields';
	import HarnessIcon from './harness/HarnessIcon.svelte';
	import RecordedValue from './RecordedValue.svelte';
	let {
		unit,
		category,
		contract,
		last
	}: {
		unit: HarnessUnit;
		category: ExplorerCategory;
		/** The contract as rows: those that are not its fields are shown above them. */
		contract: ContractRow[];
		/** For an entity the shown commit removed: the parent commit this contract was last held at. */
		last?: string;
	} = $props();
	// Only the entity that is open is read this closely.
	let groups = $derived(contractFields(unit, category));
	let facts = $derived(contractFacts(contract, unit, category));
	let title = $derived(last ? `Last contract · ${last.slice(0, 7)}` : 'Contract');
</script>

{#snippet example(item: ContractExample)}
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

<section
	class="ex-card ex-contract"
	data-harness-component="entity-contract"
	aria-label={last ? 'Last contract' : 'Contract'}
>
	<h2><HarnessIcon name="contract" size={24} /> {title}</h2>
	{#if last}
		<p class="ex-note">Removed at the shown commit; this is what its parent held.</p>
	{/if}
	{#if facts.length > 0}
		<dl class="ex-rows">
			{#each facts as row, position (position)}
				<div>
					<dt>{row.label}</dt>
					<dd>{row.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
	<p class="ex-note">
		Declared examples are written in the contract. Illustrative ones are placeholders shaped by the
		type alone. Neither is the result of a test.
	</p>
	{#each groups as group (group.id)}
		<div class="group">
			<h3>{group.title} <span class="ex-count">{group.fields.length}</span></h3>
			{#if group.fields.length === 0}
				<p class="ex-note">{group.none}</p>
			{:else}
				<ul class="fields">
					{#each group.fields as field, position (position)}
						<li class="field">
							<div class="head">
								<strong>{field.name}</strong>
								<code class="type">{field.type}</code>
							</div>
							{#if field.description}
								<p>{field.description}</p>
							{:else}
								<p class="ex-note">No description recorded.</p>
							{/if}
							<div class="examples">
								{#if field.source === 'missing'}
									<p class="ex-note">Example not recorded</p>
								{:else}
									<p class="said">
										<span class={field.source}
											>{field.source === 'declared' ? 'Declared' : 'Illustrative'}</span
										>
										{field.examples.length > 1 ? 'examples' : 'example'}
									</p>
									<ul>
										{#each field.examples as item, at (at)}<li>{@render example(item)}</li>{/each}
									</ul>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/each}
</section>

<style>
	.ex-contract {
		display: grid;
		gap: 16px;
		min-width: 0;
	}
	.group {
		display: grid;
		gap: 10px;
		min-width: 0;
	}
	h3 {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 6px 0 0;
		font-size: 1.05rem;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: 12px;
	}
	.field {
		display: grid;
		gap: 10px;
		align-content: start;
		min-width: 0;
		padding: 14px 16px;
		border: 1px solid var(--ex-line);
		border-radius: 8px;
		background: var(--ex-surface);
		overflow-wrap: anywhere;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 10px;
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
		gap: 8px;
		min-width: 0;
		padding-top: 10px;
		border-top: 1px solid var(--ex-line);
	}
	.examples ul {
		display: grid;
		gap: 8px;
	}
	.examples li {
		min-width: 0;
	}
	.said {
		color: var(--ex-soft);
		font-size: 0.85rem;
	}
	.said .declared {
		color: var(--ex-gold);
		font-weight: 600;
	}
	.said .illustrative {
		font-style: italic;
		font-weight: 600;
	}
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
		margin-top: 6px;
	}
	.whole summary {
		color: var(--ex-gold);
		font-size: 0.85rem;
		cursor: pointer;
	}
	.whole .literal {
		margin-top: 6px;
	}
</style>
