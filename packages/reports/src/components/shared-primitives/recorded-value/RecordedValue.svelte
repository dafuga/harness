<!-- @harness-tier molecule -->
<!-- @harness-atoms ../atoms -->
<script lang="ts">
	import { humanize } from '../../../helpers/strings/humanize';
	import { recordedValue } from './recordedValue';
	import { type RecordedNode } from '../../../utils/shared-primitives/recordedValue';
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
	const label = (name: string) => {
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
		<hx-dl class="fields">
			{#each node.fields as field (field.name)}
				<hx-div>
					<hx-dt title={field.name}>{label(field.name)}</hx-dt>
					<hx-dd>{@render present(field.node)}</hx-dd>
				</hx-div>
			{/each}
		</hx-dl>
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
		<hx-div class="value-scroll" tabindex="0" role="region" aria-label={rowsLabel}>
			<hx-table>
				<hx-thead
					><hx-tr
						>{#each node.columns as column (column)}<hx-th scope="col" title={column}
								>{label(column)}</hx-th
							>{/each}</hx-tr
					></hx-thead
				>
				<hx-tbody
					>{#each node.rows as row, position (position)}<hx-tr
							>{#each row as cell, column (column)}<hx-td data-field={label(node.columns[column])}
									>{@render present(cell)}</hx-td
								>{/each}</hx-tr
						>{/each}</hx-tbody
				>
			</hx-table>
		</hx-div>
		{#if node.remaining}<hx-p class="value-note">
				{node.remaining} more rows in {fullValuesLabel}.
			</hx-p>{/if}
	{/if}
{/snippet}

<hx-div class="recorded-value">{@render present(view)}</hx-div>

<style>
	.recorded-value {
		min-width: 0;
		container-type: inline-size;
		font: var(--hx-style-body-small);
		color: var(--hx-color-text-supporting);
	}
	.fields {
		display: block;
		margin: 0;
	}
	.fields > div {
		padding: var(--hx-space-9) 0;
		border-bottom: var(--hx-border-thin) solid var(--hx-color-border);
	}
	.fields > div:first-child {
		padding-top: 0;
	}
	.fields > div:last-child {
		padding-bottom: 0;
		border: 0;
	}
	dt {
		margin-bottom: var(--hx-space-5);
		font-weight: var(--hx-style-weight-semibold);
		color: var(--hx-color-text);
	}
	dd {
		margin: 0;
	}
	dd .fields {
		padding-left: var(--hx-space-12);
		border-left: var(--hx-border-thick) solid var(--hx-color-border-strong);
	}
	.scalar {
		display: inline-flex;
		align-items: baseline;
		gap: var(--hx-space-7);
		overflow-wrap: anywhere;
	}
	.value-type {
		font-size: var(--hx-type-size-2xs);
		font-weight: var(--hx-style-weight-medium);
		color: var(--hx-color-text-muted);
	}
	.value-note {
		font-size: var(--hx-type-size-compact);
		color: var(--hx-color-text-muted);
	}
	.value-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hx-space-6);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.value-list > li {
		max-width: 100%;
		padding: var(--hx-space-4) var(--hx-space-8);
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		border-radius: var(--hx-radius-xsmall);
	}
	.value-scroll {
		max-width: 100%;
		overflow: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--hx-type-size-compact);
		text-align: left;
	}
	th,
	td {
		padding: var(--hx-space-8) var(--hx-space-10);
		border-bottom: var(--hx-border-thin) solid var(--hx-color-border-strong);
		white-space: nowrap;
	}
	th {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
		font-weight: var(--hx-style-weight-semibold);
	}
	@container (max-width: 420px) {
		thead {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}
		tbody {
			display: grid;
			gap: var(--hx-space-10);
		}
		tbody tr {
			display: grid;
			padding: var(--hx-space-6) var(--hx-space-10);
			border: var(--hx-border-thin) solid var(--hx-color-border-strong);
			border-radius: var(--hx-radius-compact);
		}
		td {
			display: grid;
			grid-template-columns: minmax(60px, 0.8fr) minmax(0, 1fr);
			gap: var(--hx-space-8);
			padding: var(--hx-space-6) 0;
			white-space: normal;
		}
		td::before {
			content: attr(data-field);
			font-size: var(--hx-type-size-xs);
			color: var(--hx-color-text-muted);
		}
		td:last-child {
			border-bottom: 0;
		}
		.scalar {
			flex-wrap: wrap;
		}
	}
</style>
