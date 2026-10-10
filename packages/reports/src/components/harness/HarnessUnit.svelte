<script lang="ts">
	import type { HarnessRecord, HarnessScenario, HarnessUnit } from '../../models/Harness.types';
	import { scenarioOrigin } from '../../utils/captureProvenance';
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
	const value = (metric: string, workload: string | null = null) => {
		const found = measured.find((item) => item.metric === metric && item.workload === workload);
		if (!found) return 'not measured at this revision';
		if (found.value === null) return `unavailable: ${found.unavailable ?? 'no reason recorded'}`;
		return `${found.value} ${found.unitOfMeasure}`;
	};
	const finding = (metric: string) =>
		record?.budgets.findings.find((item) => item.unit === unit.id && item.metric === metric);
	const tested = (id: string) => record?.scenarios.find((scenario) => scenario.id === id);
</script>

<section class="hc-card hc-detail" aria-label="Component details">
	<div>
		<h2>{unit.id}</h2>
		<p class="hc-muted">
			{unit.kind} · {unit.status}{removed ? ' · Removed in this comparison' : ''}
		</p>
		<p>{unit.responsibility}</p>
	</div>
	<div role="group" aria-label="Owned interface">
		<h3>Owned interface</h3>
		<ul>
			{#each unit.owns.source as file (file)}<li class="hc-muted">{file}</li>{/each}
			{#each unit.owns.symbols as symbol (symbol)}<li>{symbol}</li>{/each}
			{#each unit.contract.inputs as item (item.name)}<li>in {item.name}: {item.type}</li>{/each}
			{#each unit.contract.outputs as item (item.name)}<li>out {item.name}: {item.type}</li>{/each}
			{#each unit.contract.errors as item (item.name)}<li>throws {item.name}</li>{/each}
		</ul>
	</div>
	<div role="group" aria-label="Depends on">
		<h3>Depends on</h3>
		{#if unit.dependencies.length === 0}<p class="hc-muted">Nothing.</p>{/if}
		<ul>
			{#each unit.dependencies as dependency (dependency.unit + dependency.via)}
				<li>
					<button type="button" class="hc-chip hc-inline" onclick={() => onselect(dependency.unit)}
						>{dependency.unit}</button
					>
					<span class="hc-muted">{dependency.via}</span>
				</li>
			{/each}
		</ul>
	</div>
	<div role="group" aria-label="Used by">
		<h3>Used by</h3>
		{#if consumers.length === 0}<p class="hc-muted">Nothing in the registry.</p>{/if}
		<ul>
			{#each consumers as consumer (consumer)}
				<li>
					<button type="button" class="hc-chip hc-inline" onclick={() => onselect(consumer)}
						>{consumer}</button
					>
				</li>
			{/each}
		</ul>
	</div>
	<div role="group" aria-label="Execution targets">
		<h3>Execution targets</h3>
		<ul>
			<li>Default: {unit.runtime.kind}</li>
			{#each unit.runtime.targets as target (target.kind + target.entry)}
				<li>{target.kind} <span class="hc-muted">{target.entry}</span></li>
			{/each}
		</ul>
	</div>
	<div role="group" aria-label="Budgets and measurements">
		<h3>Budgets and measurements</h3>
		{#if !record}<p class="hc-muted">No verification record measured this revision.</p>{/if}
		<ul>
			{#each frozen as metric (metric)}
				<li>
					{metric}: {value(metric)}
					<span class="hc-muted"
						>· frozen{finding(metric)?.baseline != null
							? ` at ${finding(metric)?.baseline}`
							: ''}</span
					>
				</li>
			{/each}
			{#each unit.budgets.performance as budget (budget.metric + budget.workload)}
				<li>
					{budget.metric} on {budget.workload}: {value(budget.metric, budget.workload)}
					<span class="hc-muted"
						>· at most {Math.round(budget.tolerance * 100)}% worse than its baseline{finding(
							budget.metric
						)
							? ` · ${finding(budget.metric)?.status}`
							: ''}</span
					>
				</li>
			{/each}
			{#if unit.budgets.performance.length === 0}
				<li class="hc-muted">No performance budget is declared.</li>
			{/if}
		</ul>
	</div>
	<div role="group" aria-label="Scenarios">
		<h3>Scenarios</h3>
		{#if covering.length === 0}<p class="hc-muted">No scenario covers this component.</p>{/if}
		<ul>
			{#each covering as scenario (scenario.id)}
				<li>
					<strong>{scenario.id}</strong>
					<span class="hc-muted">{scenario.kind}</span><br />
					States: {scenario.states
						.filter((state) => state.coverage === 'required')
						.map((state) => state.id)
						.join(', ') || 'none required'}
					{#each scenario.states.filter((state) => state.coverage !== 'required') as state (state.id)}
						<br /><span class="hc-muted">{state.id} is {state.coverage}: {state.reason}</span>
					{/each}
					{#if scenario.viewports.length}
						<br />Viewports: {scenario.viewports
							.map((item) => `${item.id} ${item.width}×${item.height}`)
							.join(', ')}
					{/if}
					<br />Checks: {scenario.tests.map((test) => `${test.id} (${test.kind})`).join(', ')}
					<br /><span class="hc-muted"
						>{#if tested(scenario.id)}{tested(scenario.id)?.status} · {scenarioOrigin(
								tested(scenario.id) as HarnessRecord['scenarios'][number]
							)}{:else}Not tested by a record of this revision.{/if}</span
					>
				</li>
			{/each}
		</ul>
	</div>
</section>
