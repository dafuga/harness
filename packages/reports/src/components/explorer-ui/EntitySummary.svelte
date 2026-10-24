<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
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
	let primary = $derived(
		measure.performance.find(
			(row) =>
				/latency|navigation|^p\d|duration|time/i.test(row.metric) && row.value !== notMeasured
		)
	);
	let memory = $derived(
		measure.performance.find(
			(row) =>
				/memory|heap|rss/i.test(row.metric) &&
				(!primary ||
					(row.workload === primary.workload &&
						row.target === primary.target &&
						row.profile === primary.profile))
		)
	);
	const where = (row: EntityMeasure['performance'][number]) =>
		[row.target, row.profile].filter(Boolean).join(' · ') || '—';
</script>

<!-- Size and timings share one profile; the contract keeps its own tab and Details section. -->
<hx-div class="ex-summary" class:compact data-harness-component="harness-entity-summary">
	<hx-section class="ex-card" aria-label="Performance profile">
		<hx-h2><HarnessIcon name="gauge" size={24} /> Performance profile</hx-h2>
		{#if comparison && compact}
			<hx-p class="ex-note"
				>Compared with first parent {shortCommit(comparison.before.commit)}.</hx-p
			>
			<hx-div class="ex-scroll">
				<hx-table class="ex-mini" aria-label="Performance metric changes">
					<hx-thead>
						<hx-tr>
							<hx-th scope="col">Metric</hx-th>
							<hx-th scope="col">Before · {shortCommit(comparison.before.commit)}</hx-th>
							<hx-th scope="col">After · {shortCommit(comparison.after.commit)}</hx-th>
							<hx-th scope="col">Change</hx-th>
						</hx-tr>
					</hx-thead>
					<hx-tbody>
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
					</hx-tbody>
				</hx-table>
			</hx-div>
		{:else}
			{#if measure.size.length > 0 || !tabled}
				<hx-dl class="ex-rows ex-figures">
					{#each measure.size as row, position (position)}
						{#if row.target !== 'none'}
							<hx-div>
								<hx-dt>{row.label}</hx-dt>
								<hx-dd class:unmeasured={row.value === notMeasured} title={row.note}>
									{row.value}
									{#if row.note && (!compact || row.value === notMeasured)}<hx-span class="ex-note"
											>{row.note}</hx-span
										>{/if}
								</hx-dd>
							</hx-div>
						{/if}
					{/each}
					{#if compact}
						<hx-div>
							<hx-dt>Latency</hx-dt>
							<hx-dd class:unmeasured={!primary} title={primary?.note}>
								{primary?.value ?? notMeasured}
							</hx-dd>
						</hx-div>
						<hx-div>
							<hx-dt>Memory</hx-dt>
							<hx-dd class:unmeasured={!memory} title={memory?.note}>
								{memory?.value ?? notMeasured}
							</hx-dd>
						</hx-div>
					{:else if measure.performance.length === 0}
						<hx-div>
							<hx-dt>Latency</hx-dt>
							<hx-dd class="unmeasured">{notMeasured}</hx-dd>
						</hx-div>
						<hx-div>
							<hx-dt>Memory</hx-dt>
							<hx-dd class="unmeasured">{notMeasured}</hx-dd>
						</hx-div>
					{:else if !tabled}
						{@const row = measure.performance[0]}
						<hx-div>
							<hx-dt>Workload</hx-dt>
							<hx-dd>{row.workload}</hx-dd>
						</hx-div>
						<hx-div>
							<hx-dt>Environment</hx-dt>
							<hx-dd class:unmeasured={where(row) === '—'}>{where(row)}</hx-dd>
						</hx-div>
						<hx-div>
							<hx-dt>{row.metric}</hx-dt>
							<hx-dd class:unmeasured={row.value === notMeasured} title={row.note}>
								{row.value}{#if row.note}<hx-span class="ex-note">{row.note}</hx-span>{/if}
							</hx-dd>
						</hx-div>
						<hx-div>
							<hx-dt>Tolerance</hx-dt>
							<hx-dd class:over={row.over}>
								{row.tolerance}{row.over ? ' · above the 5% policy' : ''}
							</hx-dd>
						</hx-div>
					{/if}
				</hx-dl>
			{/if}
			{#if measure.performance.length === 0}
				<hx-p class="ex-note">No benchmark is recorded for this revision.</hx-p>
			{:else if tabled}
				<hx-div class="ex-scroll">
					<hx-table class="ex-mini" aria-label="Timings by workload and profile">
						<hx-thead>
							<hx-tr>
								<hx-th scope="col">Workload</hx-th>
								<hx-th scope="col">Metric</hx-th>
								<hx-th scope="col">Target · profile</hx-th>
								<hx-th scope="col">Value</hx-th>
								<hx-th scope="col">Tolerance</hx-th>
							</hx-tr>
						</hx-thead>
						<hx-tbody>
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
						</hx-tbody>
					</hx-table>
				</hx-div>
			{/if}
		{/if}
	</hx-section>
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
