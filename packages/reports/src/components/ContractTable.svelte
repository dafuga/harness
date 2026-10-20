<script lang="ts">
	import type { ContractField, ContractGroup } from '../utils/contractFields';
	import HarnessIcon from './harness/HarnessIcon.svelte';
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
</script>

<div class="group" data-harness-component="contract-table">
	{#if !plain}
		<h3>{group.title} <span class="ex-count">{group.fields.length}</span></h3>
	{:else if group.fields.length > 0 || group.keepEmpty}
		<p class="label">{group.title}</p>
	{/if}
	{#if group.fields.length === 0 && !group.keepEmpty}
		<p class="ex-note">{group.none}</p>
	{:else}
		<div class="frame">
			<table aria-label={group.title}>
				<thead>
					<tr>
						{#if named}<th scope="col" class="leading">Name</th>{/if}
						<th scope="col" class="leading">Type</th>
						<th scope="col">Example</th>
						<th scope="col" class="act" aria-label="Actions"></th>
					</tr>
				</thead>
				<tbody>
					{#if group.fields.length === 0}
						<tr><td colspan={named ? 4 : 3} class="ex-note">{group.none}</td></tr>
					{/if}
					{#each group.fields as field, position (position)}
						{@const sample = field.examples[0]}
						<tr>
							{#if named}<th scope="row">{field.name}</th>{/if}
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
									onclick={(event) => onexample(field, event.currentTarget)}
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

<style>
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
	.label {
		margin: 0;
		color: var(--ex-soft);
		font-size: 0.85rem;
		font-weight: 600;
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
	/* Name and type keep their width when a returns table hides its name column. */
	.leading {
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
