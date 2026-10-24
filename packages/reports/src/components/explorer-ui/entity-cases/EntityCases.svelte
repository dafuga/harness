<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Row } from './EntityCases.types';

	import type { UsageExample } from '../../../../../../src/utils/unit-documentation/unitDocumentation';
	import { artifactCases } from './artifactCases';
	import RecordedValue from '../../shared-primitives/recorded-value/RecordedValue.svelte';
	let {
		document,
		examples,
		unit,
		callable = true
	}: {
		document?: unknown;
		examples?: UsageExample[];
		unit?: string;
		callable?: boolean;
	} = $props();
	const seen = 'What a test observed end to end';
	let observed = $derived(
		callable ? `${seen}; it is not a direct call of this function.` : `${seen}.`
	);
	let documented = $derived(examples !== undefined);
	let verb = $derived(documented ? 'Expected' : 'Observed');
	let fullValuesLabel = $derived(documented ? 'Full example values' : 'Full recorded values');
	let rowsLabel = $derived(documented ? 'Example rows' : 'Recorded rows');
	let view = $derived.by((): { gap?: string; note?: string; rows: Row[] } => {
		if (examples) {
			const none = 'No usage examples are documented at this commit.';
			if (!examples.length) return { gap: none, rows: [] };
			return {
				rows: examples.map(({ name, description, input, output, error }) => ({
					name,
					description,
					input,
					failed: error !== undefined,
					result: error !== undefined ? error : output
				}))
			};
		}
		const read = artifactCases(document, unit);
		if (read.kind === 'gap') return { gap: read.why, rows: [] };
		return {
			note:
				read.source === 'invocations' ? `Calls of ${read.symbol} recorded by a test.` : observed,
			rows: read.cases.map((item) => ({
				name: item.name,
				input: item.input,
				failed: Boolean(item.failed),
				result: item.failed ? item.error : item.output
			}))
		};
	});
	let expanded = $state(false);
</script>

<!-- Each input beside what was observed for it, or is documented to give; none says why. -->
{#if view.gap !== undefined}
	<hx-p class="cases-note" data-harness-component="entity-cases">{view.gap}</hx-p>
{:else}
	<hx-div class="cases" class:documented data-harness-component="entity-cases">
		{#if view.note}<hx-p class="cases-note">{view.note}</hx-p>{/if}
		<hx-table>
			<hx-thead>
				<hx-tr
					><hx-th scope="col">{documented ? 'Example' : 'Case'}</hx-th><hx-th scope="col"
						>Input</hx-th
					><hx-th scope="col">{verb} output</hx-th></hx-tr
				>
			</hx-thead>
			<hx-tbody>
				{#each view.rows as item, position (position)}
					<hx-tr>
						<hx-th scope="row">
							{item.name}
							{#if item.description}<hx-span class="case-description">{item.description}</hx-span
								>{/if}
						</hx-th>
						<hx-td data-label="Input"
							><hx-div class="case-value">
								<RecordedValue value={item.input} {fullValuesLabel} {rowsLabel} />
							</hx-div></hx-td
						>
						<hx-td data-label="{verb} output">
							{#if item.failed}<hx-span class="cases-error">{verb} error</hx-span>{/if}
							<hx-div class="case-value">
								<RecordedValue value={item.result} {fullValuesLabel} {rowsLabel} />
							</hx-div>
						</hx-td>
					</hx-tr>
				{/each}
			</hx-tbody>
		</hx-table>
		<hx-details bind:open={expanded}>
			<hx-summary>{fullValuesLabel}</hx-summary>
			{#if expanded}<hx-pre>{JSON.stringify(documented ? examples : document, null, 2)}</hx-pre
				>{/if}
		</hx-details>
	</hx-div>
{/if}

<style>
	.cases {
		container-type: inline-size;
	}
	.cases-note {
		margin: 0 0 var(--hx-space-12);
		font-size: var(--hx-type-size-sm);
		opacity: var(--hx-opacity-secondary);
	}
	table {
		width: 100%;
		border-collapse: separate;
	}
	thead {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	tbody {
		counter-reset: cases;
	}
	tbody tr {
		counter-increment: cases;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--hx-space-14);
		margin: 0 0 var(--hx-space-14);
		padding: var(--hx-space-16);
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		border-radius: var(--hx-radius-large);
		background: var(--hx-color-surface);
	}
	th {
		grid-column: 1 / -1;
		text-align: left;
		font-size: var(--hx-type-size-base);
		line-height: var(--hx-style-leading-normal);
	}
	tbody th::before {
		content: 'Case ' counter(cases, decimal-leading-zero);
		display: block;
		margin-bottom: var(--hx-space-4);
		font-size: var(--hx-type-size-2xs);
		font-weight: var(--hx-style-weight-medium);
		color: var(--hx-color-text-muted);
	}
	.documented tbody th::before {
		content: 'Example ' counter(cases, decimal-leading-zero);
	}
	.case-description {
		display: block;
		margin-top: var(--hx-space-4);
		font-size: var(--hx-type-size-sm);
		font-weight: var(--hx-style-weight-regular);
		color: var(--hx-color-text-supporting);
	}
	td {
		min-width: 0;
		padding: var(--hx-space-14);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-small);
		background: var(--hx-color-background);
	}
	td::before {
		content: attr(data-label);
		display: block;
		margin-bottom: var(--hx-space-10);
		font: var(--hx-style-weight-semibold) var(--hx-type-size-xs) var(--hx-font-family-body);
		color: var(--hx-color-text-supporting);
	}
	.cases pre {
		margin: 0;
		max-height: 19rem;
		overflow: auto;
		white-space: pre-wrap;
		overflow-wrap: normal;
		font: var(--hx-style-code-small);
		color: var(--hx-color-text-supporting);
	}
	.case-value {
		max-height: 25rem;
		overflow: auto;
	}
	.cases-error {
		display: block;
		margin-bottom: var(--hx-space-6);
		color: var(--hx-color-warning);
		font-size: var(--hx-type-size-xs);
	}
	summary {
		cursor: pointer;
		padding: var(--hx-space-8) 0;
		font-size: var(--hx-type-size-compact);
		color: var(--hx-color-text-supporting);
	}
	@container (max-width: 800px) {
		tbody tr {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@container (max-width: 400px) {
		tbody tr {
			padding: var(--hx-space-8);
		}
		td {
			padding: var(--hx-space-8);
		}
	}
</style>
