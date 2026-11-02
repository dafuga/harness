<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_bmfjvxz4dh -->
<script lang="ts">
	import DataTable from '../../shared-primitives/DataTable.svelte';
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
		<DataTable label="Recorded examples" tableClass="entity-cases-table">
			{#snippet header()}
				<hx-tr
					><hx-th scope="col">{documented ? 'Example' : 'Case'}</hx-th><hx-th scope="col"
						>Input</hx-th
					><hx-th scope="col">{verb} output</hx-th></hx-tr
				>
			{/snippet}
			{#snippet children()}
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
			{/snippet}
		</DataTable>
		<hx-details bind:open={expanded}>
			<hx-summary>{fullValuesLabel}</hx-summary>
			{#if expanded}<hx-pre>{JSON.stringify(documented ? examples : document, null, 2)}</hx-pre
				>{/if}
		</hx-details>
	</hx-div>
{/if}

<style>
	@import './entityCases.css';
</style>
