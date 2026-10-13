<script lang="ts">
	import type { BehaviorOutcome, EntityBehavior } from '../../../reports/src/utils/entityBehavior';
	import RuntimeArtifact from './RuntimeArtifact.svelte';
	import StatusIcon from './StatusIcon.svelte';
	let {
		shown,
		side,
		title,
		role,
		lost,
		refusals
	}: {
		shown: EntityBehavior;
		/** Which side this run is; a branch tip has only the after side. */
		side: 'before' | 'after';
		title: string;
		role: string;
		/** True when the results could not be read: each then says so instead of being awaited. */
		lost: boolean;
		refusals: Record<string, string>;
	} = $props();
	const said: Record<BehaviorOutcome, string> = {
		passed: 'Passed',
		failed: 'Failed',
		missing: 'Not recorded'
	};
	const mark = (outcome: BehaviorOutcome) => (outcome === 'passed' ? 'verified' : 'failed');
	const named = (id: string) => shown.scenarios.find((item) => item.id === id)?.title ?? id;
	const passed = $derived(
		shown.groups.length > 0 && shown.groups.every((group) => group[side] === 'passed')
	);
</script>

<div class="runtime-pane" role="group" aria-label={title}>
	<p class="runtime-pane-head">
		<strong>{title}</strong><span class="chip">{role}</span><StatusIcon
			status={passed ? 'verified' : 'failed'}
			reason={passed ? 'All results passed' : 'Not all results passed'}
		/>
	</p>
	{#each shown.groups as group (`${group.scenario}|${group.state}`)}<div class="runtime-state">
			<h4>
				<StatusIcon status={mark(group[side])} reason={said[group[side]]} />
				{named(group.scenario)} · {group.state}
			</h4>
			{#each group.lines as line (`${line.evidence}|${line.kind}`)}<div class="runtime-result">
					<p>
						<span class="chip">{line.kind}</span><span>{said[line[side].outcome]}</span
						>{#if side === 'after' && line.differences.length}<span class="muted"
								>differs at {line.differences.join(', ')}</span
							>{/if}
					</p>
					<RuntimeArtifact
						cell={line[side]}
						label={`${line.kind} of ${group.state}`}
						{lost}
						refusal={refusals[line[side].capture?.sha256 ?? '']}
					/>
				</div>{/each}
		</div>{/each}
</div>
