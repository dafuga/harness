<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import { harnessBudget } from '../../utils/explorer-ui/harnessBudget';
	import { harnessEmitted } from '../../utils/explorer-ui/harnessEmitted';
	import type {
		HarnessRecord,
		HarnessScenario,
		HarnessUnit
	} from '../../models/explorer-ui/Harness.types';
	import { scenarioOrigin } from '../../utils/reports-media/captureProvenance';
	let {
		unit,
		units,
		scenarios,
		records,
		removed = false,
		onselect
	}: {
		unit: HarnessUnit;
		units: HarnessUnit[];
		scenarios: HarnessScenario[];
		records: HarnessRecord[];
		removed?: boolean;
		onselect: (id: string) => void;
	} = $props();
	let record = $derived(
		records.find((item) => item.valid && item.status === 'passed') ??
			records.find((item) => item.valid) ??
			null
	);
	let consumers = $derived(
		units
			.filter((other) => other.dependencies.some((dependency) => dependency.unit === unit.id))
			.map((other) => other.id)
			.sort()
	);
	let covering = $derived(scenarios.filter((scenario) => scenario.units.includes(unit.id)));
	let measured = $derived((record?.measurements ?? []).filter((item) => item.unit === unit.id));
	const frozen = ['source-bytes', 'complexity', 'dependencies'];
	// A figure of the unit itself names no machine; what a benchmark reports about its run does.
	const taken = (metric: string, workload: string | null = null) =>
		measured.find(
			(item) =>
				item.metric === metric && item.workload === workload && (workload !== null || !item.profile)
		);
	const value = (metric: string, workload: string | null = null) =>
		harnessBudget(taken(metric, workload)).value;
	const finding = (metric: string) =>
		record?.budgets.findings.find((item) => item.unit === unit.id && item.metric === metric);
	// A declared freeze is a policy; a limit is a number the ledger of this revision holds.
	const reviewed = (metric: string) => ({
		declared: (metric === 'complexity' ? unit.budgets.complexity : unit.budgets.size) === 'frozen',
		limit: unit.limits?.metrics[metric],
		unmeasured: unit.limits?.unmeasured?.[metric]
	});
	const frozenLine = (metric: string) =>
		harnessBudget(taken(metric), finding(metric), reviewed(metric));
	let emitted = $derived(harnessEmitted(unit, record));
	const tested = (id: string) => record?.scenarios.find((scenario) => scenario.id === id);
</script>

<hx-section class="hc-card hc-detail" aria-label="Component details">
	<hx-div>
		<hx-h2>{unit.id}</hx-h2>
		<hx-p class="hc-muted">
			{unit.kind} · {unit.status}{removed ? ' · Removed in this comparison' : ''}
		</hx-p>
		<hx-p>{unit.responsibility}</hx-p>
	</hx-div>
	<hx-div role="group" aria-label="Owned interface">
		<hx-h3>Owned interface</hx-h3>
		<hx-ul>
			{#each unit.owns.source as file, position (position)}<hx-li class="hc-muted">{file}</hx-li
				>{/each}
			{#each unit.owns.symbols as symbol, position (position)}<hx-li>{symbol}</hx-li>{/each}
			{#each unit.contract.inputs as item, position (position)}<hx-li>
					in {item.name}: {item.type}
				</hx-li>{/each}
			{#each unit.contract.outputs as item, position (position)}<hx-li>
					out {item.name}: {item.type}
				</hx-li>{/each}
			{#each unit.contract.errors as item, position (position)}<hx-li>throws {item.name}</hx-li
				>{/each}
		</hx-ul>
	</hx-div>
	<hx-div role="group" aria-label="Depends on">
		<hx-h3>Depends on</hx-h3>
		{#if unit.dependencies.length === 0}<hx-p class="hc-muted">Nothing.</hx-p>{/if}
		<hx-ul>
			{#each unit.dependencies as dependency, position (position)}
				<hx-li>
					<hx-button
						type="button"
						class="hc-chip hc-inline"
						onclick={() => onselect(dependency.unit)}>{dependency.unit}</hx-button
					>
					<hx-span class="hc-muted">{dependency.via}</hx-span>
				</hx-li>
			{/each}
		</hx-ul>
	</hx-div>
	<hx-div role="group" aria-label="Used by">
		<hx-h3>Used by</hx-h3>
		{#if consumers.length === 0}<hx-p class="hc-muted">Nothing in the registry.</hx-p>{/if}
		<hx-ul>
			{#each consumers as consumer, position (position)}
				<hx-li>
					<hx-button type="button" class="hc-chip hc-inline" onclick={() => onselect(consumer)}
						>{consumer}</hx-button
					>
				</hx-li>
			{/each}
		</hx-ul>
	</hx-div>
	<hx-div role="group" aria-label="Execution targets">
		<hx-h3>Execution targets</hx-h3>
		<hx-ul>
			<hx-li>Default: {unit.runtime.kind}</hx-li>
			{#each unit.runtime.targets as target, position (position)}
				<hx-li>{target.kind} <hx-span class="hc-muted">{target.entry}</hx-span></hx-li>
			{/each}
		</hx-ul>
	</hx-div>
	<hx-div role="group" aria-label="Budgets and measurements">
		<hx-h3>Budgets and measurements</hx-h3>
		{#if !record}<hx-p class="hc-muted">No verification record measured this revision.</hx-p>{/if}
		<hx-ul>
			{#each frozen as metric (metric)}
				<hx-li>
					{metric}: {frozenLine(metric).value}
					<hx-span class="hc-muted">· {frozenLine(metric).limit}</hx-span>
					{#if frozenLine(metric).note}<hx-br /><hx-span class="hc-muted"
							>{frozenLine(metric).note}</hx-span
						>{/if}
				</hx-li>
			{/each}
			{#each emitted as line, position (position)}
				<hx-li>
					emitted size{line.label ? ` (${line.label})` : ''}: {line.value}
					<hx-span class="hc-muted">· {line.limit}</hx-span>
					{#if line.note}<hx-br /><hx-span class="hc-muted">{line.note}</hx-span>{/if}
				</hx-li>
			{/each}
			{#each unit.budgets.performance as budget, position (position)}
				<hx-li>
					{budget.metric} on {budget.workload}: {value(budget.metric, budget.workload)}
					<hx-span class="hc-muted"
						>· at most {Math.round(budget.tolerance * 100)}% worse than its baseline{finding(
							budget.metric
						)
							? ` · ${finding(budget.metric)?.status}`
							: ''}</hx-span
					>
				</hx-li>
			{/each}
			{#if unit.budgets.performance.length === 0}
				<hx-li class="hc-muted">No performance budget is declared.</hx-li>
			{/if}
		</hx-ul>
	</hx-div>
	<hx-div role="group" aria-label="Scenarios">
		<hx-h3>Scenarios</hx-h3>
		{#if covering.length === 0}<hx-p class="hc-muted">No scenario covers this component.</hx-p>{/if}
		<hx-ul>
			{#each covering as scenario (scenario.id)}
				<hx-li>
					<hx-strong>{scenario.id}</hx-strong>
					<hx-span class="hc-muted">{scenario.kind}</hx-span><hx-br />
					States: {scenario.states
						.filter((state) => state.coverage === 'required')
						.map((state) => state.id)
						.join(', ') || 'none required'}
					{#each scenario.states.filter((state) => state.coverage !== 'required') as state, position (position)}
						<hx-br /><hx-span class="hc-muted"
							>{state.id} is {state.coverage}: {state.reason}</hx-span
						>
					{/each}
					{#if scenario.viewports.length}
						<hx-br />Viewports: {scenario.viewports
							.map((item) => `${item.id} ${item.width}×${item.height}`)
							.join(', ')}
					{/if}
					<hx-br />Checks: {scenario.tests.map((test) => `${test.id} (${test.kind})`).join(', ')}
					<hx-br /><hx-span class="hc-muted"
						>{#if tested(scenario.id)}{tested(scenario.id)?.status} · {scenarioOrigin(
								tested(scenario.id) as HarnessRecord['scenarios'][number]
							)}{:else}Not tested by a record of this revision.{/if}</hx-span
					>
				</hx-li>
			{/each}
		</hx-ul>
	</hx-div>
</hx-section>
