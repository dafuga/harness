<script lang="ts">
	import { emittedChange } from './harnessEmitted';
	import type { HarnessRevision, HarnessUnit } from '../../../models/Harness.types.ts';
	import type { HarnessClient } from '../../../utils/harnessClient';
	import { comparedSides, harnessImpact } from './harnessImpact';
	import { type ComparedSides } from '../../../utils/harnessImpact';
	import HarnessCompareMedia from '../harness-compare-media/HarnessCompareMedia.svelte';
	import HarnessMap from '../harness-map/HarnessMap.svelte';
	import HarnessUnitView from '../HarnessUnit.svelte';
	let {
		base,
		head,
		client,
		mediaBase,
		selected,
		onselect
	}: {
		mediaBase: string;
		base: HarnessRevision | undefined;
		head: HarnessRevision;
		client: HarnessClient;
		selected: string | null;
		onselect: (id: string) => void;
	} = $props();
	const groups = [
		['direct', 'Directly changed'],
		['indirect', 'Indirectly affected'],
		['added', 'Added'],
		['removed', 'Removed']
	] as const;
	const frozen = ['source-bytes', 'complexity', 'dependencies'];
	// Any two revisions are compared from what was stored of their source, not from records.
	let compared = $state<ComparedSides | null>(null);
	$effect(() => {
		if (!base) return;
		void comparedSides(client, base, head).then(
			(found) => (compared = found ?? null),
			() => (compared = null)
		);
	});
	let impact = $derived(harnessImpact(base, head, compared));
	let gone = $derived(
		(base?.registry.units ?? []).filter((unit) => impact.removed.includes(unit.id))
	);
	let units = $derived<HarnessUnit[]>([
		...head.registry.units.filter(
			(unit) => unit.status === 'active' && !impact.removed.includes(unit.id)
		),
		...gone
	]);
	let touched = $derived(new Set([...impact.direct, ...impact.added, ...impact.removed]));
	let reasons = $derived(head.explanations.filter((reason) => touched.has(reason.unit)));
	let unit = $derived(units.find((item) => item.id === selected));
	let removed = $derived(Boolean(unit && impact.removed.includes(unit.id)));
	const measured = (revision: HarnessRevision | undefined, id: string, metric: string) => {
		const record = revision?.records.find((item) => item.valid);
		const found = record?.measurements.find((item) => item.unit === id && item.metric === metric);
		return found?.value ?? null;
	};
	const shown = (value: number | null) => (value === null ? 'unavailable' : String(value));
	const sized = (revision: HarnessRevision | undefined) => ({
		units: revision?.registry.units ?? [],
		record: revision?.records.find((item) => item.valid) ?? null
	});
</script>

<section class="hc-card" aria-label="Impact">
	<h2>Impact of this change</h2>
	<p class="hc-notice">
		{#if impact.source === 'recorded'}
			Recorded by verification {impact.record?.slice(0, 12)}: the dependency graphs of both commits
			were analysed when the head commit was verified.
		{:else if impact.source === 'source'}
			Computed from the source of both commits when the index was built: both trees were indexed and
			their graphs compared, as <code>harness impact</code> does, across {impact.files} changed files.
			{head.records.length === 0
				? 'This commit has no verification record: what it affects is known, whether it was tested is not.'
				: ''}
			{impact.expanded
				? 'A change outside any unit, or an unresolved reference, puts every test and scenario in scope.'
				: ''}
		{:else if !base}
			No base commit is selected.
		{:else}
			Computed here from the unit versions and dependencies stored at both commits, because the
			source of one of them was not stored in this index. Unresolved references and changes outside
			any unit are not known for this pair.
		{/if}
	</p>
	<div class="hc-groups">
		{#each groups as [key, title] (key)}
			<div>
				<h3>{title} ({impact[key].length})</h3>
				<ul class="hc-plain" aria-label={title}>
					{#each impact[key] as id (id)}
						<li>
							<button type="button" class="hc-chip" onclick={() => onselect(id)}>{id}</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
		<div>
			<h3>Affected scenarios ({impact.scenarios.length})</h3>
			<ul class="hc-plain" aria-label="Affected scenarios">
				{#each impact.scenarios as id (id)}<li>{id}</li>{/each}
			</ul>
		</div>
		<div>
			<h3>Uncertain ({impact.uncertain.length})</h3>
			<ul class="hc-plain" aria-label="Uncertain">
				{#each impact.uncertain as item, position (position)}
					<li>{item.detail} <span class="hc-muted">{item.reason} in {item.node}</span></li>
				{/each}
			</ul>
			{#if impact.uncertain.length === 0}
				<p class="hc-muted">
					{impact.source === 'computed' ? 'Not known here.' : 'Every reference was resolved.'}
				</p>
			{/if}
		</div>
	</div>
	<h3>Why it changed</h3>
	{#if reasons.length === 0}<p class="hc-muted">No reason is recorded for these changes.</p>{/if}
	<!-- Several reasons may share a unit, a symbol and a text; each is one recorded reason. -->
	<ul class="hc-plain" aria-label="Reasons">
		{#each reasons as reason, position (position)}
			<li>
				<strong>{reason.unit}</strong>
				<span class="hc-muted">{reason.symbol}{reason.file ? ` in ${reason.file}` : ''}</span>: {reason.behavior}
				<br /><span class="hc-muted"
					>Simpler: {reason.simplification.attempt} ({reason.simplification.outcome}). Faster:
					{reason.performance.attempt} ({reason.performance.outcome}).</span
				>
			</li>
		{/each}
	</ul>
	{#if impact.direct.length > 0}
		<h3>Before and after</h3>
		<div class="hc-table-wrap">
			<table class="hc-table" aria-label="Measurements before and after">
				<thead><tr><th>Component</th><th>Metric</th><th>Before</th><th>After</th></tr></thead>
				<tbody>
					{#each impact.direct as id (id)}
						{#each frozen as metric (metric)}
							<tr>
								<td>{id}</td><td>{metric}</td>
								<td>{shown(measured(base, id, metric))}</td>
								<td>{shown(measured(head, id, metric))}</td>
							</tr>
						{/each}
						{#each emittedChange(id, [sized(base), sized(head)]) as item, position (position)}
							<tr>
								<td>{id}</td><td>artifact-bytes ({item.label})</td>
								<td>{shown(item.before)}</td>
								<td>{shown(item.after)}</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
<HarnessCompareMedia {base} {head} {mediaBase} />
<div class="hc-panel">
	<HarnessMap {units} marks={impact.marks} {selected} {onselect} />
</div>
{#if unit}
	<HarnessUnitView
		{unit}
		units={removed ? (base?.registry.units ?? []) : units}
		scenarios={removed ? (base?.registry.scenarios ?? []) : head.registry.scenarios}
		records={removed ? (base?.records ?? []) : head.records}
		{removed}
		{onselect}
	/>
{/if}
