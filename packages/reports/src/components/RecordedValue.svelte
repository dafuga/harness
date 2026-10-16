<script lang="ts">
	import { humanize } from '../utils/entityContract';
	import { recordedValue, type RecordedNode } from '../utils/recordedValue';
	let { value }: { value: unknown } = $props();
	let view = $derived(recordedValue(value));
	const label = (name: string) => {
		const words = humanize(name);
		return words ? words[0].toUpperCase() + words.slice(1) : 'Empty field name';
	};
</script>

{#snippet present(node: RecordedNode)}
	{#if node.kind === 'scalar'}
		<span class="scalar"><span class="value-type">{node.type}</span><span>{node.text}</span></span>
		{#if node.shortened}<span class="value-note"
				>… Preview shortened; see Full recorded values.</span
			>{/if}
	{:else if node.kind === 'notice'}
		<span class="value-note">{node.text}</span>
	{:else if node.kind === 'fields'}
		<dl class="fields">
			{#each node.fields as field (field.name)}
				<div>
					<dt title={field.name}>{label(field.name)}</dt>
					<dd>{@render present(field.node)}</dd>
				</div>
			{/each}
		</dl>
		{#if node.remaining}<p class="value-note">
				{node.remaining} more fields in Full recorded values.
			</p>{/if}
	{:else if node.kind === 'list'}
		<ol class="value-list">
			{#each node.items as item, position (position)}<li>{@render present(item)}</li>{/each}
		</ol>
		{#if node.remaining}<p class="value-note">
				{node.remaining} more items in Full recorded values.
			</p>{/if}
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to scroll this data table.) -->
		<div class="value-scroll" tabindex="0" role="region" aria-label="Recorded rows">
			<table>
				<thead
					><tr
						>{#each node.columns as column (column)}<th scope="col" title={column}
								>{label(column)}</th
							>{/each}</tr
					></thead
				>
				<tbody
					>{#each node.rows as row, position (position)}<tr
							>{#each row as cell, column (column)}<td data-field={label(node.columns[column])}
									>{@render present(cell)}</td
								>{/each}</tr
						>{/each}</tbody
				>
			</table>
		</div>
		{#if node.remaining}<p class="value-note">
				{node.remaining} more rows in Full recorded values.
			</p>{/if}
	{/if}
{/snippet}

<div class="recorded-value">{@render present(view)}</div>

<style>
	.recorded-value {
		min-width: 0;
		container-type: inline-size;
		font: 0.85rem/1.5 system-ui;
		color: #d5e4ef;
	}
	.fields {
		margin: 0;
	}
	.fields > div {
		padding: 9px 0;
		border-bottom: 1px solid #233745;
	}
	.fields > div:first-child {
		padding-top: 0;
	}
	.fields > div:last-child {
		padding-bottom: 0;
		border: 0;
	}
	dt {
		margin-bottom: 5px;
		font-weight: 600;
		color: #edf4fa;
	}
	dd {
		margin: 0;
	}
	dd .fields {
		padding-left: 12px;
		border-left: 2px solid #2c4254;
	}
	.scalar {
		display: inline-flex;
		align-items: baseline;
		gap: 7px;
		overflow-wrap: anywhere;
	}
	.value-type {
		font-size: 0.63rem;
		font-weight: 500;
		color: #8da6b9;
	}
	.value-note {
		font-size: 0.8rem;
		color: #9aafc0;
	}
	.value-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.value-list > li {
		max-width: 100%;
		padding: 4px 8px;
		border: 1px solid #2c4254;
		border-radius: 5px;
	}
	.value-scroll {
		max-width: 100%;
		overflow: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
		text-align: left;
	}
	th,
	td {
		padding: 8px 10px;
		border-bottom: 1px solid #2c4254;
		white-space: nowrap;
	}
	th {
		color: #9fb6c8;
		font-size: 0.72rem;
		font-weight: 600;
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
			gap: 10px;
		}
		tbody tr {
			display: grid;
			padding: 6px 10px;
			border: 1px solid #2c4254;
			border-radius: 6px;
		}
		td {
			display: grid;
			grid-template-columns: minmax(60px, 0.8fr) minmax(0, 1fr);
			gap: 8px;
			padding: 6px 0;
			white-space: normal;
		}
		td::before {
			content: attr(data-field);
			font-size: 0.72rem;
			color: #9fb6c8;
		}
		td:last-child {
			border-bottom: 0;
		}
		.scalar {
			flex-wrap: wrap;
		}
	}
</style>
