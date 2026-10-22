<script lang="ts">
	import type { BehaviorOutcome, EntityBehavior } from '../../../utils/explorer-ui/entityBehavior';
	import EntityArtifact from './EntityArtifact.svelte';
	import HarnessVerdict from './harness-verdict/HarnessVerdict.svelte';
	let {
		shown,
		side,
		title,
		role,
		mediaBase,
		lost = false,
		unit
	}: {
		shown: EntityBehavior;
		/** Which side of the comparison this run is; the branch tip has only the after side. */
		side: 'before' | 'after';
		title: string;
		role: string;
		mediaBase: string;
		/** True when the results could not be read: each then says so instead of being awaited. */
		lost?: boolean;
		/** The function the results are shown for, when they are shown as its rows. */
		unit?: string;
	} = $props();
	const said: Record<BehaviorOutcome, string> = {
		passed: 'Passed',
		failed: 'Failed',
		missing: 'Not recorded'
	};
	const named = (id: string) => shown.scenarios.find((item) => item.id === id)?.title ?? id;
	let passed = $derived(
		shown.groups.length > 0 && shown.groups.every((group) => group[side] === 'passed')
	);
</script>

<section class="ex-pane" aria-label={title}>
	<header class="ex-pane-head">
		<strong>{title}</strong>
		<span class="ex-pill">{role}</span>
		<HarnessVerdict {passed} label={passed ? 'All results passed' : 'Not all results passed'} />
	</header>
	{#each shown.groups as group, position (position)}
		<div class="ex-state">
			<h3>
				<HarnessVerdict passed={group[side] === 'passed'} label={said[group[side]]} />
				{named(group.scenario)} · {group.state}
			</h3>
			<!-- Each result of the state with what it holds, shown without anything to press. -->
			{#each group.lines as line}
				<div class="ex-result">
					<p>
						<span class="ex-kind">{line.kind}</span>
						<span class:failed={line[side].outcome !== 'passed'}>{said[line[side].outcome]}</span>
						{#if side === 'after' && line.differences.length}
							<span class="ex-soft">differs at {line.differences.join(', ')}</span>
						{/if}
					</p>
					<EntityArtifact
						cell={line[side]}
						label={`${line.kind} of ${group.state}`}
						{mediaBase}
						{lost}
						{unit}
					/>
				</div>
			{/each}
		</div>
	{/each}
</section>
