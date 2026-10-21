<script lang="ts">
	import { notMeasured, type EntityMeasure } from '../../../utils/explorer-ui/entityMeasure';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		measure,
		compact = false
	}: {
		measure: EntityMeasure;
		/** The size and performance cards of an overview, without notes; false for Details. */
		compact?: boolean;
	} = $props();
	const displayed = (row: EntityMeasure['size'][number]) =>
		row.label === 'Emitted size' && row.note?.includes('no separate artifact')
			? 'Not applicable'
			: row.value;
	const where = (row: EntityMeasure['performance'][number]) =>
		[row.target, row.profile].filter(Boolean).join(' · ') || '—';
</script>

<!-- Size and performance only: the contract is a tab of its own, and a section of Details. -->
<div class="ex-summary" class:compact class:benchmarked={measure.performance.length > 1}>
	<section class="ex-card" aria-label="Size">
		<h2><HarnessIcon name="size" size={24} /> Size</h2>
		<dl class="ex-rows ex-figures">
			{#each measure.size as row, position (position)}
				<div>
					<dt>{row.label}</dt>
					<dd class:unmeasured={row.value === notMeasured} title={row.note}>
						{displayed(row)}
						{#if row.note && (!compact || row.value === notMeasured)}<span class="ex-note"
								>{row.note}</span
							>{/if}
					</dd>
				</div>
			{/each}
		</dl>
	</section>
	<section class="ex-card" aria-label="Performance profile">
		<h2><HarnessIcon name="gauge" size={24} /> Performance profile</h2>
		{#if measure.performance.length === 0}
			<dl class="ex-rows ex-figures">
				<div>
					<dt>Latency</dt>
					<dd class="unmeasured">{notMeasured}</dd>
				</div>
				<div>
					<dt>Memory</dt>
					<dd class="unmeasured">{notMeasured}</dd>
				</div>
			</dl>
			<p class="ex-note">No benchmark is recorded for this revision.</p>
		{:else if measure.performance.length === 1}
			{@const row = measure.performance[0]}
			<dl class="ex-rows ex-figures">
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
					<dd class:over={row.over}>{row.tolerance}{row.over ? ' · above the 5% policy' : ''}</dd>
				</div>
			</dl>
		{:else}
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
	</section>
</div>

<style>
	.benchmarked {
		grid-template-columns: minmax(0, 1fr);
	}
	.ex-note {
		display: block;
		margin-top: 4px;
	}
	td {
		overflow-wrap: normal;
		word-break: normal;
	}
</style>
