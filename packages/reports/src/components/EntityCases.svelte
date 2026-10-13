<script lang="ts">
	import { artifactCases } from '../utils/artifactCases';
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
	/** What a person reads at once of one value. */
	const most = 4000;
	// A value is written as it was recorded, a string in quotes: false is never taken for "false".
	const said = (value: unknown) => {
		const text = JSON.stringify(value, null, 2) ?? 'Not recorded';
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
						<td><pre>{said(item.input)}</pre></td>
						<td>
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
	</div>
{/if}

<style>
	.cases {
		overflow-x: auto;
	}
	.cases-note {
		margin: 0 0 8px;
		font-size: 0.85rem;
		opacity: 0.8;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}
	th,
	td {
		padding: 8px 10px 8px 0;
		border-top: 1px solid color-mix(in srgb, currentColor 16%, transparent);
		text-align: left;
		vertical-align: top;
	}
	thead th {
		border-top: 0;
		font-weight: 600;
		opacity: 0.8;
		white-space: nowrap;
	}
	tbody th {
		min-width: 12ch;
		font-weight: 600;
	}
	pre {
		/* A value keeps a line that can be read: where there is no room the table scrolls. */
		min-width: 20ch;
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.8rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.cases-error {
		display: inline-block;
		margin-bottom: 4px;
		padding: 1px 8px;
		border: 1px solid currentColor;
		border-radius: 999px;
		font-size: 0.75rem;
	}
</style>
