<script lang="ts">
	import BrowserErrors from '../../../reports/src/components/browser-errors/BrowserErrors.svelte';
	import EntityStates from '../../../reports/src/components/EntityStates.svelte';
	import { explorerName } from '../../../reports/src/utils/explorerName';
	import type {
		CoverageStanding,
		ExplorerStateCoverage
	} from '../../../reports/src/models/Explorer.types';
	import type { EntityEvidence } from '../lib/stores/entityEvidence.svelte';
	import type { EntityDetail } from '../models/Desktop.types';
	import { evidenceNotice } from '../utils/evidenceNotice';
	import RuntimeBehavior from './RuntimeBehavior.svelte';
	import StatusIcon from './StatusIcon.svelte';
	import RegressionProof from '../../../reports/src/components/RegressionProof.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	let {
		entity,
		evidence,
		workspace
	}: { entity: EntityDetail; evidence: EntityEvidence; workspace?: Workspace } = $props();
	const short = (commit: string) => commit.slice(0, 7);
	const notice = $derived(evidenceNotice(evidence.status, evidence.error, entity.kind));
	const result = $derived(evidence.status === 'ready' ? evidence.result : null);
	const visual = $derived(['pages', 'components', 'shells'].includes(entity.category));
	/** The shown revision as the one record that judges it stands; nothing is judged here. */
	const side = $derived(result?.evidence.after);
	const mark = (standing: CoverageStanding) => (standing === 'passed' ? 'verified' : 'failed');
	const told = (standing: string, reasons: string[]) =>
		[standing, reasons.filter(Boolean).join(' ')].filter(Boolean).join(': ');
	const slots = (state: ExplorerStateCoverage) =>
		state.slots.map((slot) => {
			const where = [slot.evidence, slot.kind, slot.viewport].filter(Boolean).join(' · ');
			return `${where}: ${slot.standing}${slot.reason ? ` (${slot.reason})` : ''}`;
		});
</script>

{#if visual && result}
	<EntityStates
		name={explorerName(entity)}
		evidence={result.evidence}
		scope={result.scope}
		resolveImage={(item) => evidence.url(item.phase === 'before' ? 'before' : 'after', item.file)}
	/>
	<details><summary>Verification details</summary>{@render diagnostics()}</details>
{:else}{@render diagnostics()}{/if}

{#snippet diagnostics()}
	<section class="panel coverage-panel" aria-label="Evidence coverage">
		{#if workspace}<RegressionProof
				items={side?.detail?.regressions ?? []}
				unit={entity.id}
				href={(commit) =>
					workspace.link({ commit, category: entity.category, entityId: entity.id })}
				follow={(commit) =>
					void workspace.navigate(
						workspace.link({ commit, category: entity.category, entityId: entity.id })
					)}
			/>{/if}
		<div class="row">
			<h2>Evidence</h2>
			<span class="chip runtime-chip">Runtime capture</span>{#if side}<small
					>Recorded for {short(side.commit)}{side.record
						? ` · record ${side.record.id}`
						: ''}</small
				>{/if}
		</div>
		{#if notice}<p
				class={notice.alert ? 'error' : 'empty'}
				role={notice.alert ? 'alert' : 'status'}
			>
				{notice.text}
			</p>{:else if side}{#if side.gap}<p class="runtime-gap">
					<StatusIcon status="failed" reason="Evidence missing" /><span>{side.gap}</span>
				</p>{/if}{#each side.coverage as item (item.scenario)}<article class="coverage-scenario">
					<h3>
						<StatusIcon status={mark(item.standing)} reason={told(item.standing, item.reasons)} />
						{item.title}<span class="chip">{item.kind}</span>{#if item.inheritedFrom}<small
								>Inherited from {short(item.inheritedFrom)}</small
							>{/if}
					</h3>
					<p class="muted">
						{#each item.tests as test (test.id)}<span
								>{test.id} · {test.status ?? 'not in the record'}</span
							>{/each}
					</p>
					{#each item.tests as check, position (position)}<BrowserErrors
							diagnostics={check.browserErrors}
						/>{/each}
					<table>
						<thead>
							<tr><th>State</th><th>Declared</th><th>Standing</th><th>Captures</th></tr>
						</thead>
						<tbody>
							{#each item.states as state (state.state)}<tr>
									<td>{state.state}</td>
									<td>{state.declared}</td>
									<td
										><StatusIcon
											status={mark(state.standing)}
											reason={told(state.standing, state.reasons)}
										/></td
									>
									<td>{slots(state).join('; ') || 'None declared'}</td>
								</tr>{/each}
						</tbody>
					</table>
				</article>{/each}{/if}
		<!-- What the tests were given and what they observed, as the overview shows it; never made up. -->
		{#if !notice && result}{#if result.behavior.rows.length}<RuntimeBehavior
					{result}
					{evidence}
					unit={entity.category === 'functions' ? entity.id : undefined}
				/>{:else}<p class="empty">
					No test recorded an input and an observed output for this entity at
					{short(result.scope.commit)}.
				</p>{/if}{/if}
	</section>
{/snippet}
