<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type {
		ExplorerBehavior,
		ExplorerEntity,
		ExplorerEvidence,
		ExplorerSlotCoverage as Slot,
		ExplorerScope
	} from '../../../models/explorer-ui/Explorer.types';
	import { entityLens, shortCommit, type EntityNav } from '../../../utils/explorer-ui/entityLens';
	import RegressionProof from '../../verification-evidence/RegressionProof.svelte';
	import { entityRemoved } from './entityRemoved';
	import { coverageLabels as said } from './coverageLabels';
	import { galleryItems } from '../../../utils/explorer-ui/entityScreens';
	import EvidenceGrid from '../../verification-evidence/evidence-grid/EvidenceGrid.svelte';
	import BrowserErrors from '../../shared-primitives/browser-errors/BrowserErrors.svelte';
	import EntityBehavior from '../EntityBehavior.svelte';
	import HarnessVerdict from '../harness-verdict/HarnessVerdict.svelte';
	let {
		entity,
		scope,
		evidence,
		behavior,
		nav,
		mediaBase,
		exportHref = ''
	}: {
		entity: ExplorerEntity;
		scope: ExplorerScope;
		evidence: ExplorerEvidence;
		behavior: ExplorerBehavior;
		nav: EntityNav;
		mediaBase: string;
		exportHref?: string;
	} = $props();
	let coverage = $derived(evidence.after.coverage);
	let record = $derived(evidence.after.record);
	let media = $derived(galleryItems(evidence));
	let gone = $derived(entityRemoved(evidence));
	const where = (slot: Slot) => `${slot.kind}${slot.viewport ? ` at ${slot.viewport}` : ''}`;
	const untold = (reasons: string[], slot: Slot) =>
		slot.standing !== 'passed' && !reasons.includes(slot.reason ?? '');
	// Why a scenario says a state is not required of it, in the scenario's own words.
	const declared = (scenario: string, state: string) =>
		evidence.scenarios
			.find((item) => item.id === scenario)
			?.states.find((item) => item.id === state)?.reason;
	const job = (scenario: string, test: string) =>
		record?.tests.find((item) => item.id === `${scenario}:${test}`);
</script>
<hx-div
	role="tabpanel"
	aria-label={`${entity.name} tests`}
	class="ex-stack"
	data-harness-component="harness-entity-tests"
>
	<RegressionProof
		items={evidence.after.detail?.regressions ?? []}
		unit={entity.id}
		href={(commit) =>
			nav.href(
				entityLens(nav.route, {
					commit,
					category: entity.category,
					entity: entity.id,
					tab: 'tests'
				})
			)}
		follow={(commit) =>
			nav.go(
				entityLens(nav.route, {
					commit,
					category: entity.category,
					entity: entity.id,
					tab: 'tests'
				})
			)}
	/>
	<hx-section class="ex-card" aria-labelledby="ex-verdict-title">
		<hx-h2 id="ex-verdict-title">Verification at {shortCommit(scope.commit)}</hx-h2>
		<hx-p><HarnessVerdict {...entity.verdict} /></hx-p>
		{#if entity.verdict.reasons.length}
			<hx-ul class="ex-reasons" aria-label="Why it is not proven">
				{#each entity.verdict.reasons as reason, position (position)}<hx-li>{reason}</hx-li>{/each}
			</hx-ul>
		{/if}
		{#if !record}
			<hx-p class="ex-soft">No usable verification record judges this revision.</hx-p>
		{:else if exportHref}
			<hx-p>
				<hx-a class="ex-link" href={`${exportHref}?record=${record.id}`}>Download this record</hx-a>
			</hx-p>
		{/if}
	</hx-section>
	{#if coverage.length === 0}
		<hx-p class="ex-gap">
			<HarnessVerdict passed={false} label="Evidence missing" />
			<hx-span>No scenario names this entity, so nothing proves it here.</hx-span>
		</hx-p>
	{/if}
	{#each coverage as scenario, position (position)}
		<hx-section class="ex-card" aria-label={scenario.title}>
			<hx-h2>{scenario.title}</hx-h2>
			<hx-p>
				<HarnessVerdict
					passed={scenario.standing === 'passed'}
					label={scenario.standing === 'passed'
						? 'Every required state is proven'
						: said[scenario.standing]}
					reasons={scenario.reasons}
				/>
			</hx-p>
			<hx-p class="ex-soft">
				{scenario.kind} scenario{scenario.inheritedFrom
					? ` · result inherited from ${shortCommit(scenario.inheritedFrom)}`
					: ''}
			</hx-p>
			{#if scenario.reasons.length}
				<hx-ul class="ex-reasons" aria-label={`Why ${scenario.title} is not proven`}>
					{#each scenario.reasons as reason}<hx-li>{reason}</hx-li>{/each}
				</hx-ul>
			{/if}
			<hx-div class="ex-scroll">
				<hx-table class="ex-mini" aria-label={`States of ${scenario.title}`}>
					<hx-thead>
						<hx-tr>
							<hx-th scope="col">State</hx-th>
							<hx-th scope="col">Required</hx-th>
							<hx-th scope="col">Proven</hx-th>
						</hx-tr>
					</hx-thead>
					<hx-tbody>
						{#each scenario.states as state}
							<hx-tr>
								<hx-th scope="row">{state.state}</hx-th>
								<hx-td
									>{state.declared}{declared(scenario.scenario, state.state)
										? `: ${declared(scenario.scenario, state.state)}`
										: ''}</hx-td
								>
								<hx-td>
									{#if state.standing === 'inapplicable'}
										<hx-span class="ex-soft">{said.inapplicable}</hx-span>
									{:else}
										<HarnessVerdict
											passed={state.standing === 'passed'}
											label={said[state.standing]}
											reasons={state.reasons}
										/>
									{/if}
									<!-- Sentences and slots in the order the host gave them; none is a key. -->
									{#each state.reasons as reason}
										<hx-span class="ex-soft ex-block">{reason}</hx-span>
									{/each}
									<!-- A slot is told where the state has not already said the same of it. -->
									{#each state.slots.filter((slot) => untold(state.reasons, slot)) as slot}
										<hx-span class="ex-soft ex-block"
											>{where(slot)}: {slot.reason ?? said[slot.standing]}</hx-span
										>
									{/each}
								</hx-td>
							</hx-tr>
						{/each}
					</hx-tbody>
				</hx-table>
			</hx-div>
			<hx-ul class="ex-checks" aria-label="Checks">
				{#each scenario.tests as test}
					<hx-li>
						<HarnessVerdict
							passed={test.status === 'passed'}
							label={test.status ?? 'not in the record'}
						/>
						<hx-span>{test.id}</hx-span>
						<hx-span class="ex-soft">{test.status ?? 'not in the record'}</hx-span>
						{#if job(scenario.scenario, test.id)}
							<hx-span class="ex-soft"
								>{job(scenario.scenario, test.id)?.kind} · {job(scenario.scenario, test.id)
									?.durationMs} ms</hx-span
							>
						{/if}
					</hx-li>
				{/each}
			</hx-ul>
			{#each scenario.tests as check, position (position)}<BrowserErrors
					diagnostics={check.browserErrors}
				/>{/each}
		</hx-section>
	{/each}
	{#if gone.length}
		<hx-section class="ex-card" aria-label="No longer declared">
			<hx-h2>No longer declared at {shortCommit(scope.commit)}</hx-h2>
			<hx-p class="ex-soft">
				What {shortCommit(scope.parent ?? '')} declared and this commit does not: it has a result before
				and none after.
			</hx-p>
			<hx-ul class="ex-reasons">
				{#each gone as item}<hx-li>{item}</hx-li>{/each}
			</hx-ul>
		</hx-section>
	{/if}
	{#if behavior.rows.length}
		{#key entity.id + scope.commit}
			<EntityBehavior
				{behavior}
				{scope}
				{mediaBase}
				{nav}
				unit={entity.category === 'functions' ? entity.id : undefined}
			/>
		{/key}
	{/if}
	{#if media.length}
		<EvidenceGrid items={media} assetBase={mediaBase} idPrefix="entity-" />
	{/if}
</hx-div>
