<!-- @harness-tier organism -->
<!-- @harness-atoms atoms -->
<!-- @harness-uid u_3bme4zikv6 -->
<script lang="ts">
	import './contractTableMobile.css';
	import './contractTableInfo.css';
	import type { ContractField, ContractGroup } from '../../utils/explorer-ui/contractFields';
	import HarnessIcon from '../explorer-ui/HarnessIcon.svelte';
	import DataTable from './DataTable.svelte';
	import CodeLine from './CodeLine.svelte';
	import { defaultText, nameWords, requirementLabel } from './contractTableCells';
	/** One group of contract fields as a table: name, type, a clipped example and its info control. */
	let {
		group,
		plain = false,
		onexample
	}: {
		group: ContractGroup;
		/** Inside a section with its own heading: a plain label, and an empty group is its none text. */
		plain?: boolean;
		/** Opens a field's full example; its button is passed so focus can return to it. */
		onexample: (field: ContractField, opener: HTMLButtonElement) => void;
	} = $props();
	// A row previews its first example, cut short, and names placeholders; the modal shows all.
	const labels = { illustrative: 'Illustrative', missing: 'Example not recorded' };
	let named = $derived(!group.hideNames);
	let metadata = $derived(group.id === 'inputs' || group.inputMetadata === true);
</script>

<hx-div class="group" data-harness-component="contract-table">
	{#if !plain}
		<hx-h3
			>{group.title}
			{#if group.fields.length > 0}<hx-span class="ex-count">{group.fields.length}</hx-span
				>{/if}</hx-h3
		>
	{:else if group.fields.length > 0 || group.keepEmpty}
		<hx-p class="label">{group.title}</hx-p>
	{/if}
	{#if group.fields.length === 0 && !group.keepEmpty}
		<hx-p class="ex-note">{group.none}</hx-p>
	{:else}
		<DataTable label={group.title} className="frame" isEmpty={group.fields.length === 0}>
			{#snippet header()}
				<hx-tr>
					{#if named}<hx-th scope="col" class="leading">Name</hx-th>{/if}
					<hx-th scope="col" class="leading">Type</hx-th>
					{#if metadata}
						<hx-th scope="col">Requirement</hx-th>
						<hx-th scope="col">Default</hx-th>
					{/if}
					<hx-th scope="col">Example</hx-th>
					<hx-th scope="col" class="act" aria-label="Actions"></hx-th>
				</hx-tr>
			{/snippet}
			{#snippet empty()}
				<hx-tr
					><hx-td colspan={(named ? 4 : 3) + (metadata ? 2 : 0)} class="ex-note">{group.none}</hx-td
					></hx-tr
				>
			{/snippet}
			{#snippet children()}
				{#each group.fields as field, position (position)}
					{@const sample = field.examples[0]}
					{@const defaultValue = defaultText(field)}
					<hx-tr data-contract-input={metadata ? '' : undefined}>
						{#if named}<hx-th scope="row"
								>{#each nameWords(field.name) as word, position (position)}{#if position > 0}.<hx-wbr
										/>{/if}{word}{/each}</hx-th
							>{/if}
						<hx-td><hx-code class="type">{field.type}</hx-code></hx-td>
						{#if metadata}
							<hx-td><hx-span class="requirement">{requirementLabel(field)}</hx-span></hx-td>
							<hx-td
								><hx-span class="default"
									>{#if defaultValue !== null}Default: <hx-code>{defaultValue}</hx-code
										>{:else if field.defaultKind === 'omitted' || field.required === true}No default{:else}Default
										not recorded{/if}</hx-span
								></hx-td
							>
						{/if}
						<hx-td>
							{#if field.source !== 'declared'}<hx-i>{labels[field.source]}</hx-i>{/if}
							<hx-div class="example">
								{#if sample}<CodeLine text={sample.text} />{/if}
							</hx-div>
						</hx-td>
						<hx-td class="act">
							<hx-button
								type="button"
								class="info"
								aria-label={`View example for ${field.name}`}
								aria-haspopup="dialog"
								onclick={(event) => onexample(field, event.currentTarget)}
								><HarnessIcon name="info" size={18} /></hx-button
							>
						</hx-td>
					</hx-tr>
				{/each}
			{/snippet}
		</DataTable>
	{/if}
</hx-div>

<style>
	.group {
		display: grid;
		gap: var(--hx-space-10);
		min-width: 0;
	}
	h3 {
		display: flex;
		align-items: center;
		gap: var(--hx-space-10);
		margin: var(--hx-space-6) 0 0;
		font-size: var(--hx-type-size-base);
	}
	.label {
		margin: 0;
		color: var(--hx-color-text-supporting);
		font-size: var(--hx-type-size-sm);
		font-weight: var(--hx-style-weight-semibold);
	}
	/* Full identifiers and types wrap within their cells so metadata stays readable. */
	.group :global(.frame) {
		min-width: 0;
		overflow-x: auto;
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-small);
		background: var(--hx-color-surface);
	}
	th,
	td {
		padding: var(--hx-space-8) var(--hx-space-6);
		text-align: start;
		border-bottom: var(--hx-border-thin) solid var(--hx-color-border);
		vertical-align: middle;
	}
	.group :global(tbody tr:last-child > *) {
		border-bottom: 0;
	}
	.group :global(thead th) {
		white-space: nowrap;
		color: var(--hx-color-text-supporting);
		font-size: var(--hx-type-size-compact);
		font-weight: var(--hx-style-weight-semibold);
	}
	.group :global(tbody th) {
		white-space: normal;
		overflow-wrap: anywhere;
	}
	/* Where there is room, name and type keep their width, also when a returns table hides its
	   names; a longer name or type widens its own column instead. */
	.leading {
		width: 24%;
	}
	.type {
		padding: var(--hx-space-2) var(--hx-space-4);
		border: var(--hx-border-thin) solid color-mix(in srgb, var(--hx-color-primary) 45%, transparent);
		border-radius: var(--hx-radius-compact);
		color: var(--hx-color-primary);
		font-size: var(--hx-type-size-sm);
		white-space: normal;
		overflow-wrap: anywhere;
	}
	/* On wide tables a name breaks only after a dot and a type only at its spaces; a word that is
	   still too long widens its column, and the frame scrolls rather than splitting it. */
	@media (min-width: 901px) {
		.group :global(tbody th),
		.type {
			overflow-wrap: normal;
		}
	}
	/* A zero intrinsic width lets the table fit its actions; min-width fills the assigned column.
	   Longer previews are clipped with an ellipsis; the dialog shows the full example. */
	.example {
		width: 0;
		min-width: max(100%, 14ch);
		max-width: var(--hx-layout-contract-example);
		overflow: hidden;
		color: var(--hx-color-text-supporting);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.requirement,
	.default {
		display: block;
		overflow-wrap: normal;
	}
	.default code {
		overflow-wrap: anywhere;
	}
	.act {
		width: 60px;
		padding: var(--hx-space-2) var(--hx-space-8);
		text-align: end;
	}
</style>
