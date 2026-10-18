<script lang="ts">
	import { tick } from 'svelte';
	import type { ExplorerCategory } from '../models/Explorer.types';
	import type { HarnessUnit } from '../models/Harness.types';
	import type { ContractRow } from '../utils/entityContract';
	import { contractFacts, contractFields, type ContractField } from '../utils/contractFields';
	import ContractExample from './ContractExample.svelte';
	import HarnessIcon from './harness/HarnessIcon.svelte';
	import Modal from './Modal.svelte';
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
	// Examples stay out of the page until one field's is opened, and focus returns to its button.
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
							<tr
								><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Description</th
								></tr
							>
						</thead>
						<tbody>
							{#each group.fields as field, position (position)}
								<tr>
									<th scope="row">{field.name}</th>
									<td>
										<div class="typed">
											<code>{field.type}</code>
											<button
												type="button"
												class="info"
												aria-label={`View example for ${field.name}`}
												aria-haspopup="dialog"
												onclick={(event) => openExample(field, event)}
												><HarnessIcon name="info" size={18} /></button
											>
										</div>
									</td>
									<td class:none={!field.description}>
										{field.description ?? 'No description recorded.'}
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
	/* On a phone the table keeps its columns and scrolls inside this frame, not the page. */
	.frame {
		min-width: 0;
		overflow-x: auto;
		border: 1px solid var(--ex-line);
		border-radius: 8px;
		background: var(--ex-surface);
	}
	table {
		width: 100%;
		min-width: 32rem;
		border-collapse: collapse;
		table-layout: fixed;
	}
	th,
	td {
		padding: 8px 14px;
		text-align: start;
		border-bottom: 1px solid var(--ex-line);
		vertical-align: baseline;
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
	thead th:first-child {
		width: 22%;
	}
	thead th:nth-child(2) {
		width: 30%;
	}
	.typed {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	code {
		min-width: 0;
		padding: 2px 8px;
		border: 1px solid color-mix(in srgb, var(--ex-gold) 45%, transparent);
		border-radius: 6px;
		color: var(--ex-gold);
		font-size: 0.88rem;
		overflow-wrap: anywhere;
	}
	.info {
		display: inline-grid;
		flex: none;
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
	.none {
		color: var(--ex-soft);
	}
</style>
