<script lang="ts">
	import { artifactCases } from '../utils/artifactCases';
	import { compactRecordedValue } from '../utils/compactRecordedValue';
	let {
		document,
		unit,
		callable = true
	}: {
		/** A recorded result, parsed, after its bytes were read and checked. */
		document: unknown;
		/** The unit whose calls are shown; calls recorded for another one are not. */
		unit?: string;
		/** False for a page, a component, a config or a service: nothing a test calls directly. */
		callable?: boolean;
	} = $props();
	let read = $derived(artifactCases(document, unit));
	const seen = 'What a test observed end to end';
	// Only of a function is it worth saying that what a test saw was no call of it.
	let observed = $derived(
		callable ? `${seen}; it is not a direct call of this function.` : `${seen}.`
	);
	let expanded = $state(false);
	const most = 4000;
	const said = (value: unknown) => {
		const text = compactRecordedValue(value);
		return text.length > most ? `${text.slice(0, most)}\n… (shortened)` : text;
	};
</script>

<!-- Each input beside what was observed for it; a result that holds none says why. -->
{#if read.kind === 'gap'}
	<p class="cases-note">{read.why}</p>
{:else}
	<div class="cases">
		<p class="cases-note">
			{read.source === 'invocations' ? `Calls of ${read.symbol} recorded by a test.` : observed}
		</p>
		<table>
			<thead>
				<tr
					><th scope="col">Case</th><th scope="col">Input</th><th scope="col">Observed output</th
					></tr
				>
			</thead>
			<tbody>
				{#each read.cases as item, position (position)}
					<tr>
						<th scope="row">{item.name}</th>
						<td data-label="Input"><pre>{said(item.input)}</pre></td>
						<td data-label="Observed output">
							{#if item.failed}
								<span class="cases-error">Observed error</span>
								<pre>{said(item.error)}</pre>
							{:else}
								<pre>{said(item.output)}</pre>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<details bind:open={expanded}>
			<summary>Full recorded values</summary>
			{#if expanded}<pre>{JSON.stringify(document, null, 2)}</pre>{/if}
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
</style>
