<!-- @harness-tier organism -->
<!-- @harness-atoms atoms -->
<script lang="ts">
	import type { ContractField, ContractGroup } from '../../utils/explorer-ui/contractFields';
	import HarnessIcon from '../explorer-ui/HarnessIcon.svelte';
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

<hx-div class="group" data-harness-component="contract-table">
	{#if !plain}
		<hx-h3>{group.title} <hx-span class="ex-count">{group.fields.length}</hx-span></hx-h3>
	{:else if group.fields.length > 0 || group.keepEmpty}
		<hx-p class="label">{group.title}</hx-p>
	{/if}
	{#if group.fields.length === 0 && !group.keepEmpty}
		<hx-p class="ex-note">{group.none}</hx-p>
	{:else}
		<hx-div class="frame">
			<hx-table aria-label={group.title}>
				<hx-thead>
					<hx-tr>
						{#if named}<hx-th scope="col" class="leading">Name</hx-th>{/if}
						<hx-th scope="col" class="leading">Type</hx-th>
						<hx-th scope="col">Example</hx-th>
						<hx-th scope="col" class="act" aria-label="Actions"></hx-th>
					</hx-tr>
				</hx-thead>
				<hx-tbody>
					{#if group.fields.length === 0}
						<hx-tr><hx-td colspan={named ? 4 : 3} class="ex-note">{group.none}</hx-td></hx-tr>
					{/if}
					{#each group.fields as field, position (position)}
						{@const sample = field.examples[0]}
						<hx-tr>
							{#if named}<hx-th scope="row">{field.name}</hx-th>{/if}
							<hx-td><hx-code class="type">{field.type}</hx-code></hx-td>
							<hx-td>
								<hx-div class="example">
									{#if field.source !== 'declared'}<hx-i>{labels[field.source]}</hx-i>{/if}
									{#if sample}<hx-code
											>{sample.text.slice(0, 240)}{sample.text.length > 240 ? '...' : ''}</hx-code
										>{/if}
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
				</hx-tbody>
			</hx-table>
		</hx-div>
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
		color: var(--ex-soft);
		font-size: var(--hx-type-size-sm);
		font-weight: var(--hx-style-weight-semibold);
	}
	/* A name or type is never broken: a column is at least as wide as its own, and a table wider
	   than a phone scrolls sideways inside this frame while the page keeps its width. */
	.frame {
		min-width: 0;
		overflow-x: auto;
		border: var(--hx-border-thin) solid var(--ex-line);
		border-radius: var(--hx-radius-small);
		background: var(--ex-surface);
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		padding: var(--hx-space-8) var(--hx-space-6);
		text-align: start;
		border-bottom: var(--hx-border-thin) solid var(--ex-line);
		vertical-align: middle;
	}
	tbody tr:last-child > * {
		border-bottom: 0;
	}
	thead th {
		color: var(--ex-soft);
		font-size: var(--hx-type-size-compact);
		font-weight: var(--hx-style-weight-semibold);
	}
	tbody th {
		white-space: nowrap;
	}
	/* Where there is room, name and type keep their width, also when a returns table hides its
	   names; a longer name or type widens its own column instead. */
	.leading {
		width: 30%;
	}
	.type {
		padding: var(--hx-space-2) var(--hx-space-4);
		border: var(--hx-border-thin) solid color-mix(in srgb, var(--ex-gold) 45%, transparent);
		border-radius: var(--hx-radius-compact);
		color: var(--ex-gold);
		font-size: var(--hx-type-size-sm);
		white-space: nowrap;
	}
	/* A preview fills its column but asks no more room than a short value and its label need;
	   a longer value is clipped with an ellipsis, and its full example opens in the dialog. */
	.example {
		min-width: 100%;
		max-width: var(--hx-layout-contract-example);
		overflow: hidden;
		color: var(--ex-soft);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.act {
		width: 60px;
		padding: var(--hx-space-2) var(--hx-space-8);
		text-align: end;
	}
	.info {
		display: inline-grid;
		place-items: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: var(--hx-border-thin) solid transparent;
		border-radius: var(--hx-radius-compact);
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
		outline: var(--hx-border-thick) solid var(--ex-gold);
		outline-offset: var(--hx-border-thin);
	}
	@media (pointer: coarse) {
		.info {
			width: 44px;
			height: 44px;
		}
	}
</style>
