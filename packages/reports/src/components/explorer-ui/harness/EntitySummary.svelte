<script lang="ts">
	import { notMeasured, type EntityMeasure } from '../../../utils/explorer-ui/entityMeasure';
	import { shortCommit } from '../../../utils/explorer-ui/entityLens';
	import { metricChanges, type MetricComparison } from '../../../utils/explorer-ui/metricChanges';
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
<div class="ex-summary" class:compact data-harness-component="harness-entity-summary">
	<section class="ex-card" aria-label="Performance profile">
		<h2><HarnessIcon name="gauge" size={24} /> Performance profile</h2>
		{#if comparison && compact}
			<p class="ex-note">Compared with first parent {shortCommit(comparison.before.commit)}.</p>
			<div class="ex-scroll">
				<table class="ex-mini" aria-label="Performance metric changes">
					<thead>
						<tr>
							<th scope="col">Metric</th>
							<th scope="col">Before · {shortCommit(comparison.before.commit)}</th>
							<th scope="col">After · {shortCommit(comparison.after.commit)}</th>
							<th scope="col">Change</th>
						</tr>
					</thead>
					<tbody>
						{#each changes as row (row.key)}
							<tr>
								<th scope="row">{row.label}</th>
								<td>
									{row.before}
									{#if row.beforeContext}<span class="ex-note">{row.beforeContext}</span>{/if}
								</td>
								<td>
									{row.after}
									{#if row.afterContext}<span class="ex-note">{row.afterContext}</span>{/if}
								</td>
								<td>{row.change}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			{#if measure.size.length > 0 || !tabled}
				<dl class="ex-rows ex-figures">
					{#each measure.size as row, position (position)}
						{#if row.target !== 'none'}
							<div>
								<dt>{row.label}</dt>
								<dd class:unmeasured={row.value === notMeasured} title={row.note}>
									{row.value}
									{#if row.note && (!compact || row.value === notMeasured)}<span class="ex-note"
											>{row.note}</span
										>{/if}
								</dd>
							</div>
						{/if}
					{/each}
					{#if compact}
						<div>
							<dt>Latency</dt>
							<dd class:unmeasured={!primary} title={primary?.note}>
								{primary?.value ?? notMeasured}
							</dd>
						</div>
						<div>
							<dt>Memory</dt>
							<dd class:unmeasured={!memory} title={memory?.note}>
								{memory?.value ?? notMeasured}
							</dd>
						</div>
					{:else if measure.performance.length === 0}
						<div>
							<dt>Latency</dt>
							<dd class="unmeasured">{notMeasured}</dd>
						</div>
						<div>
							<dt>Memory</dt>
							<dd class="unmeasured">{notMeasured}</dd>
						</div>
					{:else if !tabled}
						{@const row = measure.performance[0]}
						<div>
							<dt>Workload</dt>
							<dd>{row.workload}</dd>
						</div>
						<div>
							<dt>Environment</dt>
							<dd class:unmeasured={where(row) === '—'}>{where(row)}</dd>
						</div>
						<div>
							<dt>{row.metric}</dt>
							<dd class:unmeasured={row.value === notMeasured} title={row.note}>
								{row.value}{#if row.note}<span class="ex-note">{row.note}</span>{/if}
							</dd>
						</div>
						<div>
							<dt>Tolerance</dt>
							<dd class:over={row.over}>
								{row.tolerance}{row.over ? ' · above the 5% policy' : ''}
							</dd>
						</div>
					{/if}
				</dl>
			{/if}
			{#if measure.performance.length === 0}
				<p class="ex-note">No benchmark is recorded for this revision.</p>
			{:else if tabled}
				<div class="ex-scroll">
					<table class="ex-mini" aria-label="Timings by workload and profile">
						<thead>
							<tr>
								<th scope="col">Workload</th>
								<th scope="col">Metric</th>
								<th scope="col">Target · profile</th>
								<th scope="col">Value</th>
								<th scope="col">Tolerance</th>
							</tr>
						</thead>
						<tbody>
							{#each measure.performance as row, position (position)}
								<tr>
									<td>{row.workload}</td>
									<td>{row.metric}</td>
									<td>{where(row)}</td>
									<td class:unmeasured={row.value === notMeasured} title={row.note}
										>{row.value}{#if row.note}<span class="ex-note">{row.note}</span>{/if}</td
									>
									<td class:over={row.over}
										>{row.tolerance}{row.over ? ' · above the 5% policy' : ''}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</section>
</div>

<style>
	.ex-note {
		display: block;
		margin-top: 4px;
	}
	td {
		overflow-wrap: normal;
		word-break: normal;
	}
</style>
