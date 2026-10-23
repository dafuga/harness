<script lang="ts">
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
	type Row = {
		name: string;
		description?: string;
		input: unknown;
		failed: boolean;
		result: unknown;
	};
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
	<p class="cases-note" data-harness-component="entity-cases">{view.gap}</p>
{:else}
	<div class="cases" class:documented data-harness-component="entity-cases">
		{#if view.note}<p class="cases-note">{view.note}</p>{/if}
		<table>
			<thead>
				<tr
					><th scope="col">{documented ? 'Example' : 'Case'}</th><th scope="col">Input</th><th
						scope="col">{verb} output</th
					></tr
				>
			</thead>
			<tbody>
				{#each view.rows as item, position (position)}
					<tr>
						<th scope="row">
							{item.name}
							{#if item.description}<span class="case-description">{item.description}</span>{/if}
						</th>
						<td data-label="Input"
							><div class="case-value">
								<RecordedValue value={item.input} {fullValuesLabel} {rowsLabel} />
							</div></td
						>
						<td data-label="{verb} output">
							{#if item.failed}<span class="cases-error">{verb} error</span>{/if}
							<div class="case-value">
								<RecordedValue value={item.result} {fullValuesLabel} {rowsLabel} />
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<details bind:open={expanded}>
			<summary>{fullValuesLabel}</summary>
			{#if expanded}<pre>{JSON.stringify(documented ? examples : document, null, 2)}</pre>{/if}
		</details>
	</div>
{/if}

<style>
	.cases {
		container-type: inline-size;
	}
	.cases-note {
		margin: 0 0 12px;
		font-size: 0.85rem;
		opacity: 0.75;
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
		gap: 14px;
		margin: 0 0 14px;
		padding: 16px;
		border: 1px solid #2c4254;
		border-radius: 12px;
		background: #10212e;
	}
	th {
		grid-column: 1 / -1;
		text-align: left;
		font-size: 0.95rem;
		line-height: 1.5;
	}
	tbody th::before {
		content: 'Case ' counter(cases, decimal-leading-zero);
		display: block;
		margin-bottom: 4px;
		font-size: 0.7rem;
		font-weight: 500;
		color: #9aafc0;
	}
	.documented tbody th::before {
		content: 'Example ' counter(cases, decimal-leading-zero);
	}
	.case-description {
		display: block;
		margin-top: 4px;
		font-size: 0.85rem;
		font-weight: 400;
		color: #b6cad9;
	}
	td {
		min-width: 0;
		padding: 14px;
		border: 1px solid #263d4d;
		border-radius: 8px;
		background: #0b1821;
	}
	td::before {
		content: attr(data-label);
		display: block;
		margin-bottom: 10px;
		font: 600 0.75rem system-ui;
		color: #a9bfd0;
	}
	.cases pre {
		margin: 0;
		max-height: 19rem;
		overflow: auto;
		white-space: pre-wrap;
		overflow-wrap: normal;
		font:
			0.78rem/1.6 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		color: #d5e4ef;
	}
	.case-value {
		max-height: 25rem;
		overflow: auto;
	}
	.cases-error {
		display: block;
		margin-bottom: 6px;
		color: #f5bd69;
		font-size: 0.75rem;
	}
	summary {
		cursor: pointer;
		padding: 8px 0;
		font-size: 0.8rem;
		color: #b6cad9;
	}
	@container (max-width: 800px) {
		tbody tr {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@container (max-width: 400px) {
		tbody tr {
			padding: 8px;
		}
		td {
			padding: 8px;
		}
	}
</style>
