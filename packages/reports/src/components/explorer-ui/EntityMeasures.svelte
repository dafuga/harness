<script lang="ts">
	import type { Line } from "./EntityMeasures.types";

	import type { HarnessRecord, HarnessUnit } from '../../models/explorer-ui/Harness.types';
	import { humanize } from '../../helpers/strings/humanize';
	import { harnessBudget } from '../../utils/explorer-ui/harnessBudget';
	import { reasonText } from '../../utils/explorer-ui/explorerState';
	import { harnessEmitted } from '../../utils/explorer-ui/harnessEmitted';
	let { unit, record }: { unit: HarnessUnit; record: HarnessRecord | null } = $props();
	const frozen = ['source-bytes', 'complexity', 'dependencies'];
	let measured = $derived((record?.measurements ?? []).filter((item) => item.unit === unit.id));
	// A figure of the unit itself names no machine; what a benchmark reports about its run does.
	const taken = (metric: string, workload: string | null = null) =>
		measured.find(
			(item) =>
				item.metric === metric && item.workload === workload && (workload !== null || !item.profile)
		);
	const finding = (metric: string) =>
		record?.budgets.findings.find((item) => item.unit === unit.id && item.metric === metric);
	// A declared freeze is a policy; a limit is a number the ledger of this revision holds.
	const reviewed = (metric: string) => ({
		declared: (metric === 'complexity' ? unit.budgets.complexity : unit.budgets.size) === 'frozen',
		limit: unit.limits?.metrics[metric],
		unmeasured: unit.limits?.unmeasured?.[metric]
	});
	// A recorded note may name a file; where a file is belongs to the source tab, not to this one.
	const told = (line: Line): Line => ({
		...line,
		value: reasonText(line.value),
		...(line.note ? { note: reasonText(line.note) } : {})
	});
	let lines = $derived<Line[]>([
		...frozen.map((metric) => ({
			metric: humanize(metric),
			...harnessBudget(taken(metric), finding(metric), reviewed(metric))
		})),
		...harnessEmitted(unit, record).map((line) => ({
			metric: `emitted size${line.label ? ` · ${line.label}` : ''}`,
			value: line.value,
			limit: line.limit,
			note: line.note
		})),
		...unit.budgets.performance.map((budget) => ({
			metric: `${humanize(budget.metric)} on ${humanize(budget.workload)}`,
			value: harnessBudget(taken(budget.metric, budget.workload)).value,
			limit: `at most ${Math.round(budget.tolerance * 100)}% worse than its baseline`,
			note: finding(budget.metric)?.status
		}))
	]);

</script>

<section
	class="ex-card"
	aria-labelledby="ex-measures-title"
	data-harness-component="harness-entity-measures"
>
	<h2 id="ex-measures-title">Measurements and frozen limits</h2>
	{#if !record}
		<p class="ex-soft">No verification record measured this revision.</p>
	{/if}
	<div class="ex-scroll">
		<table class="ex-mini" aria-label="Measurements and frozen limits">
			<thead>
				<tr>
					<th scope="col">Metric</th>
					<th scope="col">Measured</th>
					<th scope="col">Limit</th>
					<th scope="col">Note</th>
				</tr>
			</thead>
			<tbody>
				{#each lines.map(told) as line, position (position)}
					<tr>
						<th scope="row">{line.metric}</th>
						<td>{line.value}</td>
						<td>{line.limit}</td>
						<td>{line.note ?? '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if unit.budgets.performance.length === 0}
		<p class="ex-note">No performance budget is declared for it.</p>
	{/if}
</section>
