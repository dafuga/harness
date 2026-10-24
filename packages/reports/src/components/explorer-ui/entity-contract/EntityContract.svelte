<script lang="ts">
	import { tick } from 'svelte';
	import type { ExplorerCategory } from '../../../models/explorer-ui/Explorer.types';
	import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';
	import type { ContractRow } from '../../../utils/explorer-ui/entityContract';
	import {
		callableContracts,
		contractFacts,
		contractFields,
		typeLabel,
		type CallableContract
	} from './contractFields';
	import { modelContract, serviceContract } from './serviceMethods';
	import { type ContractField } from '../../../utils/explorer-ui/contractFields';
	import ContractExample from '../../shared-primitives/ContractExample.svelte';
	import ContractTable from '../../shared-primitives/ContractTable.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
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
	// A service or model shows each declared method apart; what no method declares is said once.
	let service = $derived(
		category === 'services'
			? serviceContract(unit)
			: category === 'models'
				? modelContract(unit)
				: { methods: [], facts: [] }
	);
	// Their declared errors are one table under the methods, never repeated under each method.
	let byMethod = $derived(category === 'services' || category === 'models');
	// A model's own declarations, the one its title names first; a field's value is never guessed.
	let shapes = $derived.by((): CallableContract[] => {
		if (category !== 'models') return [];
		const all = unit.modelDefinitions ?? [];
		const named = all.filter((item) => item.name === unit.title);
		return (named.length > 0 ? named : all)
			.filter((item) => item.fields.length > 0)
			.map((item) => ({
				name: item.name,
				signature: `${item.kind} ${item.name}`,
				groups: [
					{
						id: 'inputs' as const,
						title: 'Fields',
						none: 'No fields declared.',
						fields: item.fields.map((field) => ({
							name: field.optional ? `${field.name}?` : field.name,
							type: typeLabel(field.type),
							source: 'missing' as const,
							examples: []
						}))
					}
				]
			}));
	});
	// A model whose revision records no member, as an older type-only address, says so alone.
	let bare = $derived(category === 'models' && service.methods.length === 0 && shapes.length === 0);
	let groups = $derived(
		(callables.length > 0 || service.methods.length > 0 || category === 'models'
			? []
			: contractFields(unit, category)
		).filter((group) => !byMethod || group.id !== 'errors')
	);
	let serviceErrors = $derived.by(() => {
		if (!byMethod) return undefined;
		const group = contractFields(unit, category).find((group) => group.id === 'errors');
		return (
			group && {
				...group,
				fields: group.fields.map((field, index) => ({
					...field,
					name: unit.contract.errors[index].name
				}))
			}
		);
	});
	let facts = $derived(
		callables.length > 0
			? []
			: [
					...contractFacts(contract, unit, category),
					...service.facts.filter((row) => row.label !== 'Errors not tied to a method')
				]
	);
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
	{@render summaryRows(facts)}
	{#each callables as callable, position (position)}
		{@render callableSection(callable, `${callable.name} contract`)}
	{:else}
		{#if bare}
			<p class="ex-note">This revision records no public methods or fields of this model.</p>
		{:else}
			<p class="ex-note">
				Declared examples are written in the contract. Illustrative ones are placeholders shaped by
				the type alone. Neither is the result of a test.
			</p>
		{/if}
		{#each shapes as shape, position (position)}
			{@render callableSection(shape, `${shape.name} fields`)}
		{/each}
		{#each service.methods as method (method.name)}
			{@render callableSection(method, `${method.name} method`)}
		{:else}
			{#each groups as group (group.id)}
				<ContractTable {group} onexample={openExample} />
			{/each}
		{/each}
	{/each}
	{#if serviceErrors}<ContractTable group={serviceErrors} onexample={openExample} />{/if}
</section>
{#snippet summaryRows(rows: ContractRow[])}
	{#if rows.length > 0}
		<dl class="ex-rows">
			{#each rows as row, position (position)}
				<div>
					<dt>{row.label}</dt>
					<dd>{row.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
{/snippet}
{#snippet callableSection(callable: CallableContract, label: string)}
	{@const parameters = callable.groups.find(
		(group) => group.id === 'inputs' && group.title === 'Parameters'
	)}
	<section class="callable" aria-label={label}>
		<h3>
			<code class:call-signature={parameters !== undefined}
				>{#if parameters}<span class="callable-name">{callable.name}</span
					>({#each parameters.fields as parameter, index (index)}{index ? ', ' : ''}<span
							class="callable-parameter">{parameter.name}</span
						>{/each}){:else}{callable.signature}{/if}</code
			>
		</h3>
		{#each callable.groups.filter((group) => !byMethod || group.id !== 'errors') as group (group.id)}
			<ContractTable
				{group}
				plain
				onexample={(field, button) => openExample(field, button, callable.name)}
			/>
		{/each}
	</section>
{/snippet}
<Modal open={chosen !== null} title={chosen?.title ?? ''} variant="text" onClose={closeExample}>
	{#if chosen}<ContractExample field={chosen.field} />{/if}
</Modal>

<style>
	.ex-contract {
		display: grid;
		gap: var(--hx-space-16);
		min-width: 0;
	}
	/* Shared callable headings keep method names primary and parameters distinct. */
	.callable {
		display: grid;
		gap: var(--hx-space-10);
		min-width: 0;
	}
	.callable + .callable {
		padding-top: var(--hx-space-16);
		border-top: var(--hx-border-thin) solid var(--ex-line);
	}
	.call-signature {
		color: var(--hx-color-text-muted);
	}
	.callable-name {
		color: var(--hx-color-text);
	}
	.callable-parameter {
		color: var(--hx-color-text-supporting);
	}
	.callable h3 {
		margin: 0;
		color: var(--ex-text);
		font-size: var(--hx-type-size-base);
		font-weight: var(--hx-style-weight-semibold);
		overflow-wrap: anywhere;
	}
</style>
