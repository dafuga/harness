<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Pill from '$shared/explorer-ui/explorer-kit/Pill.svelte';
	import type { BehaviorOutcome, EntityBehavior } from '$reports/utils/entityBehavior';
	import RuntimeArtifact from './RuntimeArtifact.svelte';
	import Status from '$shared/shared-primitives/status/Status.svelte';
	let {
		shown,
		side,
		title,
		role,
		lost,
		refusals,
		unit
	}: {
		shown: EntityBehavior;
		/** Which side this run is; a branch tip has only the after side. */
		side: 'before' | 'after';
		title: string;
		role: string;
		/** True when the results could not be read: each then says so instead of being awaited. */
		lost: boolean;
		refusals: Record<string, string>;
		/** The function the results are shown for, when they are shown as its rows. */
		unit?: string;
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

<hx-div class="runtime-pane" role="group" aria-label={title}>
	<hx-p class="runtime-pane-head">
		<hx-strong>{title}</hx-strong><Pill as="span" variant="chip" tone="runtime-run-chip"
			>{role}</Pill
		><Status
			variant="icon"
			status={passed ? 'verified' : 'failed'}
			reason={passed ? 'All results passed' : 'Not all results passed'}
		/>
	</hx-p>
	{#each shown.groups as group (`${group.scenario}|${group.state}`)}<hx-div class="runtime-state">
			<hx-h4>
				<Status variant="icon" status={mark(group[side])} reason={said[group[side]]} />
				{named(group.scenario)} · {group.state}
			</hx-h4>
			{#each group.lines as line (`${line.evidence}|${line.kind}`)}<hx-div class="runtime-result">
					<hx-p>
						<Pill as="span" variant="chip" tone="runtime-run-chip">{line.kind}</Pill><hx-span
							>{said[line[side].outcome]}</hx-span
						>{#if side === 'after' && line.differences.length}<hx-span class="muted"
								>differs at {line.differences.join(', ')}</hx-span
							>{/if}
					</hx-p>
					<RuntimeArtifact
						cell={line[side]}
						label={`${line.kind} of ${group.state}`}
						{lost}
						refusal={refusals[line[side].capture?.sha256 ?? '']}
						{unit}
					/>
				</hx-div>{/each}
		</hx-div>{/each}
</hx-div>
