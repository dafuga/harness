<script lang="ts">
	import { tick } from 'svelte';
	import type { ExplorerCategory } from '../../../models/explorer-ui/Explorer.types';
	import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';
	import type { ContractRow } from '../../../utils/explorer-ui/entityContract';
	import { callableContracts, contractFacts, contractFields } from './contractFields';
	import { type ContractField } from '../../../utils/explorer-ui/contractFields';
	import ContractExample from '../../shared-primitives/ContractExample.svelte';
	import ContractTable from '../../shared-primitives/ContractTable.svelte';
	import HarnessIcon from '../harness/HarnessIcon.svelte';
	import Modal from '../../shared-primitives/Modal.svelte';
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
	// A function's callables each show their own signature; whole-module facts say nothing of them.
	let callables = $derived(category === 'functions' ? callableContracts(unit) : []);
	let groups = $derived(callables.length > 0 ? [] : contractFields(unit, category));
	let facts = $derived(callables.length > 0 ? [] : contractFacts(contract, unit, category));
	let title = $derived(last ? `Last contract · ${last.slice(0, 7)}` : 'Contract');
	let chosen = $state<{ field: ContractField; title: string } | null>(null);
	let opener: HTMLButtonElement | null = null;
	/** A callable's field is titled with its function, as `toKebabCase · value`. */
	function openExample(field: ContractField, button: HTMLButtonElement, callable?: string) {
		opener = button;
		chosen = { field, title: `Example for ${callable ? `${callable} · ` : ''}${field.name}` };
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
	{#each callables as callable, position (position)}
		<section class="callable" aria-label={`${callable.name} contract`}>
			<h3><code>{callable.signature}</code></h3>
			{#each callable.groups as group (group.id)}
				<ContractTable
					{group}
					plain
					onexample={(field, button) => openExample(field, button, callable.name)}
				/>
			{/each}
		</section>
	{:else}
		<p class="ex-note">
			Declared examples are written in the contract. Illustrative ones are placeholders shaped by
			the type alone. Neither is the result of a test.
		</p>
		{#each groups as group (group.id)}
			<ContractTable {group} onexample={openExample} />
		{/each}
	{/each}
</section>
<Modal open={chosen !== null} title={chosen?.title ?? ''} variant="text" onClose={closeExample}>
	{#if chosen}<ContractExample field={chosen.field} />{/if}
</Modal>

<style>
	.ex-contract {
		display: grid;
		gap: 16px;
		min-width: 0;
	}
	/* One compact section per callable, separated by a rule; a long signature wraps in place. */
	.callable {
		display: grid;
		gap: 10px;
		min-width: 0;
	}
	.callable + .callable {
		padding-top: 16px;
		border-top: 1px solid var(--ex-line);
	}
	.callable h3 {
		margin: 0;
		color: var(--ex-text);
		font-size: 1rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
</style>
