<script lang="ts">
	import { tick } from 'svelte';
	import type { ExplorerCategory } from '../../models/Explorer.types';
	import type { HarnessUnit } from '../../models/Harness.types';
	import type { ContractRow } from '../../utils/entityContract';
	import { contractFacts, contractFields } from './contractFields';
	import { type ContractField } from '../../utils/contractFields';
	import ContractExample from '../ContractExample.svelte';
	import HarnessIcon from '../harness/HarnessIcon.svelte';
	import Modal from '../Modal.svelte';
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
	let groups = $derived(contractFields(unit, category));
	let facts = $derived(contractFacts(contract, unit, category));
	let title = $derived(last ? `Last contract · ${last.slice(0, 7)}` : 'Contract');
	// A row previews its first example, cut short, and names placeholders; the modal shows all.
	const labels = { illustrative: 'Illustrative', missing: 'Example not recorded' };
	let chosen = $state<ContractField | null>(null);
	let opener: HTMLButtonElement | null = null;
	function openExample(field: ContractField, event: MouseEvent) {
		opener = event.currentTarget as HTMLButtonElement;
		chosen = field;
	}
	async function closeExample() {
		chosen = null;
		await tick();
		opener?.focus();
	}
</script>
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
				<div class="frame">
					<table aria-label={group.title}>
						<thead>
							<tr>
								<th scope="col">Name</th>
								<th scope="col">Type</th>
								<th scope="col">Example</th>
								<th scope="col" class="act" aria-label="Actions"></th>
							</tr>
						</thead>
						<tbody>
							{#each group.fields as field, position (position)}
								{@const sample = field.examples[0]}
								<tr>
									<th scope="row">{field.name}</th>
									<td><code class="type">{field.type}</code></td>
									<td class="example">
										{#if field.source !== 'declared'}<i>{labels[field.source]}</i>{/if}
										{#if sample}<code
												>{sample.text.slice(0, 240)}{sample.text.length > 240 ? '...' : ''}</code
											>{/if}
									</td>
									<td class="act">
										<button
											type="button"
											class="info"
											aria-label={`View example for ${field.name}`}
											aria-haspopup="dialog"
											onclick={(event) => openExample(field, event)}
											><HarnessIcon name="info" size={18} /></button
										>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/each}
</section>
<Modal
	open={chosen !== null}
	title={chosen ? `Example for ${chosen.name}` : ''}
	variant="text"
	onClose={closeExample}
>
	{#if chosen}<ContractExample field={chosen} />{/if}
</Modal>

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
	/* Keep all columns visible on phones and leave room for the trailing touch target. */
	.frame {
		min-width: 0;
		overflow-x: auto;
		border: 1px solid var(--ex-line);
		border-radius: 8px;
		background: var(--ex-surface);
	}
	table {
		width: 100%;
		min-width: 0;
		border-collapse: collapse;
		table-layout: fixed;
	}
	th,
	td {
		padding: 8px 6px;
		text-align: start;
		border-bottom: 1px solid var(--ex-line);
		vertical-align: middle;
		overflow-wrap: break-word;
	}
	tbody tr:last-child > * {
		border-bottom: 0;
	}
	thead th {
		color: var(--ex-soft);
		font-size: 0.8rem;
		font-weight: 600;
	}
	thead th:nth-child(-n + 2) {
		width: 30%;
	}
	.type {
		padding: 2px 4px;
		border: 1px solid color-mix(in srgb, var(--ex-gold) 45%, transparent);
		border-radius: 6px;
		color: var(--ex-gold);
		font-size: 0.88rem;
	}
	.example {
		color: var(--ex-soft);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.act {
		position: sticky;
		inset-inline-end: 0;
		width: 60px;
		padding: 2px 8px;
		text-align: end;
		background: var(--ex-surface);
	}
	.info {
		display: inline-grid;
		place-items: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 6px;
		background: none;
		color: var(--ex-soft);
		cursor: pointer;
	}
	.info:hover,
	.info:focus-visible {
		border-color: var(--ex-line);
		color: var(--ex-gold);
	}
	.info:focus-visible {
		outline: 2px solid var(--ex-gold);
		outline-offset: 1px;
	}
	@media (pointer: coarse) {
		.info {
			width: 44px;
			height: 44px;
		}
	}
</style>
