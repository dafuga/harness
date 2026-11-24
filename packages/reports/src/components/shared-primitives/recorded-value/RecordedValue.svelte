<!-- @harness-tier organism -->
<!-- @harness-atoms ../atoms -->
<!-- @harness-uid u_ui4g5eenml -->
<script lang="ts">
	import DetailList from '../DetailList.svelte';
	import DataTable from '../DataTable.svelte';
	import { humanize } from '../../../helpers/strings/humanize';
	import { recordedValue } from './recordedValue';
	import type {
		RecordedField,
		RecordedNode
	} from '../../../utils/shared-primitives/recordedValue.types';
	let {
		value,
		fullValuesLabel = 'Full recorded values',
		rowsLabel = 'Recorded rows'
	}: {
		value: unknown;
		/** Where a shortened value can be read whole; an authored example was never recorded. */
		fullValuesLabel?: string;
		rowsLabel?: string;
	} = $props();
	let view = $derived(recordedValue(value));
	const fieldLabel = (name: string) => {
		const words = humanize(name);
		return words ? words[0].toUpperCase() + words.slice(1) : 'Empty field name';
	};
</script>

{#snippet present(node: RecordedNode)}
	{#if node.kind === 'scalar'}
		<hx-span class="scalar"
			><hx-span class="value-type">{node.type}</hx-span><hx-span>{node.text}</hx-span></hx-span
		>
		{#if node.shortened}<hx-span class="value-note"
				>… Preview shortened; see {fullValuesLabel}.</hx-span
			>{/if}
	{:else if node.kind === 'notice'}
		<hx-span class="value-note">{node.text}</hx-span>
	{:else if node.kind === 'fields'}
		<DetailList
			rows={node.fields}
			rowKey={(field) => field.name}
			termTitle={(field) => field.name}
			className="fields"
		>
			{#snippet label(field: RecordedField)}{fieldLabel(field.name)}{/snippet}
			{#snippet children(field: RecordedField)}{@render present(field.node)}{/snippet}
		</DetailList>
		{#if node.remaining}<hx-p class="value-note">
				{node.remaining} more fields in {fullValuesLabel}.
			</hx-p>{/if}
	{:else if node.kind === 'list'}
		<hx-ol class="value-list">
			{#each node.items as item, position (position)}<hx-li>{@render present(item)}</hx-li>{/each}
		</hx-ol>
		{#if node.remaining}<hx-p class="value-note">
				{node.remaining} more items in {fullValuesLabel}.
			</hx-p>{/if}
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to scroll this data table.) -->
		<DataTable label={rowsLabel} tableClass="recorded-value-table" className="value-scroll">
			{#snippet header()}<hx-tr
					>{#each node.columns as column (column)}<hx-th scope="col" title={column}
							>{fieldLabel(column)}</hx-th
						>{/each}</hx-tr
				>{/snippet}
			{#snippet children()}{#each node.rows as row, position (position)}<hx-tr
						>{#each row as cell, column (column)}<hx-td
								data-field={fieldLabel(node.columns[column])}>{@render present(cell)}</hx-td
							>{/each}</hx-tr
					>{/each}{/snippet}
		</DataTable>
		{#if node.remaining}<hx-p class="value-note">
				{node.remaining} more rows in {fullValuesLabel}.
			</hx-p>{/if}
	{/if}
{/snippet}

<hx-div class="recorded-value">{@render present(view)}</hx-div>

<style>
	@import './recordedValue.css';
</style>
