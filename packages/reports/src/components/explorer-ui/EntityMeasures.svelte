<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Line } from './EntityMeasures.types';

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

<hx-section
	class="ex-card"
	aria-labelledby="ex-measures-title"
	data-harness-component="harness-entity-measures"
>
	<hx-h2 id="ex-measures-title">Measurements and frozen limits</hx-h2>
	{#if !record}
		<hx-p class="ex-soft">No verification record measured this revision.</hx-p>
	{/if}
	<hx-div class="ex-scroll">
		<hx-table class="ex-mini" aria-label="Measurements and frozen limits">
			<hx-thead>
				<hx-tr>
					<hx-th scope="col">Metric</hx-th>
					<hx-th scope="col">Measured</hx-th>
					<hx-th scope="col">Limit</hx-th>
					<hx-th scope="col">Note</hx-th>
				</hx-tr>
			</hx-thead>
			<hx-tbody>
				{#each lines.map(told) as line, position (position)}
					<hx-tr>
						<hx-th scope="row">{line.metric}</hx-th>
						<hx-td>{line.value}</hx-td>
						<hx-td>{line.limit}</hx-td>
						<hx-td>{line.note ?? '—'}</hx-td>
					</hx-tr>
				{/each}
			</hx-tbody>
		</hx-table>
	</hx-div>
	{#if unit.budgets.performance.length === 0}
		<hx-p class="ex-note">No performance budget is declared for it.</hx-p>
	{/if}
</hx-section>
