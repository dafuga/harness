<script lang="ts">
	import type { ContractRow } from '../../utils/entityContract';
	import { notMeasured, type EntityMeasure } from '../../utils/entityMeasure';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		contract,
		measure,
		compact = false,
		last
	}: {
		contract: ContractRow[];
		measure: EntityMeasure;
		/** The row of three cards above the evidence of an overview; false for the Details page. */
		compact?: boolean;
		/** For an entity the shown commit removed: the parent commit this contract was last held at. */
		last?: string;
	} = $props();
	let title = $derived(last ? `Last contract · ${last.slice(0, 7)}` : 'Contract');
	// The purpose is the sentence under the name of an overview; it is not said twice there.
	let rows = $derived(compact ? contract.filter((row) => row.label !== 'Purpose') : contract);
	const where = (row: EntityMeasure['performance'][number]) =>
		[row.target, row.profile].filter(Boolean).join(' · ') || '—';
</script>

<div class="ex-summary" class:compact>
	<section class="ex-card" aria-label={last ? 'Last contract' : 'Contract'}>
		<h2><HarnessIcon name="contract" size={24} /> {title}</h2>
		{#if last}
			<p class="ex-note">Removed at the shown commit; this is what its parent held.</p>
		{/if}
		<dl class="ex-rows">
			{#each rows as row, position (position)}
				<div>
					<dt>{row.label}</dt>
					<dd>
						{row.value}
						<!-- Where a contract says what each item is, the details say it; an overview names. -->
						{#if !compact && row.items}
							<ul class="ex-items">
								{#each row.items as item}
									<li><strong>{item.name}</strong> <span>{item.text}</span></li>
								{/each}
							</ul>
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
	</section>
	<section class="ex-card" aria-label="Size">
		<h2><HarnessIcon name="size" size={24} /> Size</h2>
		<dl class="ex-rows ex-figures">
			{#each measure.size as row, position (position)}
				<div>
					<dt>{row.label}</dt>
					<dd class:unmeasured={row.value === notMeasured} title={row.note}>
						{row.value}
						{#if row.note && !compact}<span class="ex-note">{row.note}</span>{/if}
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
			<p class="ex-note">No performance budget is declared for it.</p>
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
					<dd class:unmeasured={row.value === notMeasured}>{row.value}</dd>
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
								<td class:unmeasured={row.value === notMeasured}>{row.value}</td>
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
