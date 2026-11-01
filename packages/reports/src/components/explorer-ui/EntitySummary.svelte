<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import DetailList from '../shared-primitives/DetailList.svelte';
	import { entitySummaryFacts, measurementLocation as where } from './entitySummaryFacts';
	import DataTable from '../shared-primitives/DataTable.svelte';
	import Card from './explorer-kit/Card.svelte';
	import { notMeasured, type EntityMeasure } from '../../utils/explorer-ui/entityMeasure';
	import { shortCommit } from '../../helpers/strings/shortCommit';
	import { metricChanges, type MetricComparison } from '../../utils/explorer-ui/metricChanges';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		measure,
		compact = false,
		comparison = null
	}: {
		measure: EntityMeasure;
		/** The measurement profile of an overview, without notes; false for Details. */
		compact?: boolean;
		comparison?: MetricComparison | null;
	} = $props();
	// Overview selects one context; Details retains every workload, target and profile.
	let tabled = $derived(!compact && measure.performance.length > 1);
	let changes = $derived(
		comparison && compact ? metricChanges(comparison.before.measure, comparison.after.measure) : []
	);
</script>

<!-- Size and timings share one profile; the contract keeps its own tab and Details section. -->
<hx-div class="ex-summary" class:compact data-harness-component="harness-entity-summary">
	<Card as="section" label="Performance profile">
		<hx-h2><HarnessIcon name="gauge" size={24} /> Performance profile</hx-h2>
		{#if comparison && compact}
			<hx-p class="ex-note"
				>Compared with first parent {shortCommit(comparison.before.commit)}.</hx-p
			>
			<DataTable label="Performance metric changes" tableClass="ex-mini" className="ex-scroll">
				{#snippet header()}
					<hx-tr>
						<hx-th scope="col">Metric</hx-th>
						<hx-th scope="col">Before · {shortCommit(comparison.before.commit)}</hx-th>
						<hx-th scope="col">After · {shortCommit(comparison.after.commit)}</hx-th>
						<hx-th scope="col">Change</hx-th>
					</hx-tr>
				{/snippet}
				{#snippet children()}
					{#each changes as row (row.key)}
						<hx-tr>
							<hx-th scope="row">{row.label}</hx-th>
							<hx-td>
								{row.before}
								{#if row.beforeContext}<hx-span class="ex-note">{row.beforeContext}</hx-span>{/if}
							</hx-td>
							<hx-td>
								{row.after}
								{#if row.afterContext}<hx-span class="ex-note">{row.afterContext}</hx-span>{/if}
							</hx-td>
							<hx-td>{row.change}</hx-td>
						</hx-tr>
					{/each}
				{/snippet}
			</DataTable>
		{:else}
			{#if measure.size.length > 0 || !tabled}
				<DetailList
					rows={entitySummaryFacts(measure, compact)}
					rowKey={(_, position) => position}
					className="ex-rows ex-figures"
					valueClass={(row) => row.className}
					valueTitle={(row) => row.title}
				>
					{#snippet label(row)}{row.label}{/snippet}
					{#snippet children(row)}{row.value}{#if row.note}<hx-span class="ex-note"
								>{row.note}</hx-span
							>{/if}{/snippet}
				</DetailList>
			{/if}
			{#if measure.performance.length === 0}
				<hx-p class="ex-note">No benchmark is recorded for this revision.</hx-p>
			{:else if tabled}
				<DataTable
					label="Timings by workload and profile"
					tableClass="ex-mini"
					className="ex-scroll"
				>
					{#snippet header()}
						<hx-tr>
							<hx-th scope="col">Workload</hx-th>
							<hx-th scope="col">Metric</hx-th>
							<hx-th scope="col">Target · profile</hx-th>
							<hx-th scope="col">Value</hx-th>
							<hx-th scope="col">Tolerance</hx-th>
						</hx-tr>
					{/snippet}
					{#snippet children()}
						{#each measure.performance as row, position (position)}
							<hx-tr>
								<hx-td>{row.workload}</hx-td>
								<hx-td>{row.metric}</hx-td>
								<hx-td>{where(row)}</hx-td>
								<hx-td class:unmeasured={row.value === notMeasured} title={row.note}
									>{row.value}{#if row.note}<hx-span class="ex-note">{row.note}</hx-span
										>{/if}</hx-td
								>
								<hx-td class:over={row.over}
									>{row.tolerance}{row.over ? ' · above the 5% policy' : ''}</hx-td
								>
							</hx-tr>
						{/each}
					{/snippet}
				</DataTable>
			{/if}
		{/if}
	</Card>
</hx-div>

<style>
	.ex-note {
		display: block;
		margin-top: var(--hx-space-4);
	}
	td {
		overflow-wrap: normal;
		word-break: normal;
	}
</style>
