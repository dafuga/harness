<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Notice from '$shared/explorer-ui/explorer-kit/Notice.svelte';
	import EmptyState from '$shared/explorer-ui/explorer-kit/EmptyState.svelte';
	import Pill from '$shared/explorer-ui/explorer-kit/Pill.svelte';
	import DataTable from '$shared/shared-primitives/DataTable.svelte';
	import { shortCommit } from '$reports/helpers/strings/shortCommit';

	import BrowserErrors from '$shared/shared-primitives/browser-errors/BrowserErrors.svelte';
	import EntityStates from '$shared/explorer-ui/EntityStates.svelte';
	import { explorerName } from '$reports/utils/explorerName';
	import type { CoverageStanding, ExplorerStateCoverage } from '$reports/models/Explorer.types';
	import type { EntityEvidence } from '../../lib/stores/explorer-ui/entityEvidence.svelte';
	import type { EntityDetail } from '../../models/development-tooling/Desktop.types';
	import { evidenceNotice } from '../../utils/verification-evidence/evidenceNotice';
	import RuntimeBehavior from '../execution-runtimes/RuntimeBehavior.svelte';
	import Status from '$shared/shared-primitives/status/Status.svelte';
	import RegressionProof from '$shared/verification-evidence/RegressionProof.svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	let {
		entity,
		evidence,
		workspace
	}: { entity: EntityDetail; evidence: EntityEvidence; workspace?: Workspace } = $props();
	const notice = $derived(evidenceNotice(evidence.status, evidence.error, entity.kind));
	const result = $derived(evidence.status === 'ready' ? evidence.result : null);
	const visual = $derived(['pages', 'components', 'layouts'].includes(entity.category));
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
	<hx-details><hx-summary>Verification details</hx-summary>{@render diagnostics()}</hx-details>
{:else}{@render diagnostics()}{/if}

{#snippet diagnostics()}
	<hx-section class="panel coverage-panel" aria-label="Evidence coverage">
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
		<hx-div class="row">
			<hx-h2>Evidence</hx-h2>
			<Pill as="span" variant="chip" tone="runtime-chip coverage-panel-chip">Runtime capture</Pill
			>{#if side}<hx-small
					>Recorded for {shortCommit(side.commit)}{side.record
						? ` · record ${side.record.id}`
						: ''}</hx-small
				>{/if}
		</hx-div>
		{#if notice}<Notice
				className={notice.alert ? 'error' : 'empty'}
				role={notice.alert ? 'alert' : 'status'}
			>
				{notice.text}
			</Notice>{:else if side}{#if side.gap}<Notice
					as="p"
					className={'runtime-gap coverage-panel-runtime-gap'}
				>
					<Status variant="icon" status="failed" reason="Evidence missing" /><hx-span
						>{side.gap}</hx-span
					>
				</Notice>{/if}{#each side.coverage as item (item.scenario)}<hx-article
					class="coverage-scenario"
				>
					<hx-h3>
						<Status
							variant="icon"
							status={mark(item.standing)}
							reason={told(item.standing, item.reasons)}
						/>
						{item.title}<Pill as="span" variant="chip" tone="coverage-panel-chip">{item.kind}</Pill
						>{#if item.inheritedFrom}<hx-small
								>Inherited from {shortCommit(item.inheritedFrom)}</hx-small
							>{/if}
					</hx-h3>
					<hx-p class="muted">
						{#each item.tests as test (test.id)}<hx-span
								>{test.id} · {test.status ?? 'not in the record'}</hx-span
							>{/each}
					</hx-p>
					{#each item.tests as check, position (position)}
						{#if check.browserErrors?.length}<BrowserErrors
								diagnostics={check.browserErrors}
							/>{/if}
					{/each}
					<DataTable label="Scenario coverage">
						{#snippet header()}
							<hx-tr
								><hx-th>State</hx-th><hx-th>Declared</hx-th><hx-th>Standing</hx-th><hx-th
									>Captures</hx-th
								></hx-tr
							>
						{/snippet}
						{#snippet children()}
							{#each item.states as state (state.state)}<hx-tr>
									<hx-td>{state.state}</hx-td>
									<hx-td>{state.declared}</hx-td>
									<hx-td
										><Status
											variant="icon"
											status={mark(state.standing)}
											reason={told(state.standing, state.reasons)}
										/></hx-td
									>
									<hx-td>{slots(state).join('; ') || 'None declared'}</hx-td>
								</hx-tr>{/each}
						{/snippet}
					</DataTable>
				</hx-article>{/each}{/if}
		<!-- What the tests were given and what they observed, as the overview shows it; never made up. -->
		{#if !notice && result}{#if result.behavior.rows.length}<RuntimeBehavior
					{result}
					{evidence}
					unit={entity.category === 'functions' ? entity.id : undefined}
				/>{:else}<EmptyState as="p" className="empty coverage-panel-empty">
					No test recorded an input and an observed output for this entity at
					{shortCommit(result.scope.commit)}.
				</EmptyState>{/if}{/if}
	</hx-section>
{/snippet}
