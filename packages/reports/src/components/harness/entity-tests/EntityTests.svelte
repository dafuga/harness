<script lang="ts">
	import type { CoverageStanding, ExplorerBehavior, ExplorerEntity, ExplorerEvidence, ExplorerSlotCoverage as Slot, ExplorerScope } from "../../../models/Explorer.types.ts";
	import { entityLens, shortCommit, type EntityNav } from "../../../utils/entityLens";
	import RegressionProof from '../../RegressionProof.svelte';
	import { entityRemoved } from "./entityRemoved";
	import { galleryItems } from "../../../utils/entityScreens";
	import EvidenceGrid from '../../evidence-grid/EvidenceGrid.svelte';
	import BrowserErrors from '../../browser-errors/BrowserErrors.svelte';
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
	const said: Record<CoverageStanding, string> = {
		passed: 'Proven',
		failed: 'Failed',
		stale: 'Stale',
		missing: 'Evidence missing',
		incomplete: 'Coverage incomplete',
		inapplicable: 'Not applicable'
	};
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

<div role="tabpanel" aria-label={`${entity.name} tests`} class="ex-stack">
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
	<section class="ex-card" aria-labelledby="ex-verdict-title">
		<h2 id="ex-verdict-title">Verification at {shortCommit(scope.commit)}</h2>
		<p><HarnessVerdict {...entity.verdict} /></p>
		{#if entity.verdict.reasons.length}
			<ul class="ex-reasons" aria-label="Why it is not proven">
				{#each entity.verdict.reasons as reason, position (position)}<li>{reason}</li>{/each}
			</ul>
		{/if}
		{#if !record}
			<p class="ex-soft">No usable verification record judges this revision.</p>
		{:else if exportHref}
			<p>
				<a class="ex-link" href={`${exportHref}?record=${record.id}`}>Download this record</a>
			</p>
		{/if}
	</section>
	{#if coverage.length === 0}
		<p class="ex-gap">
			<HarnessVerdict passed={false} label="Evidence missing" />
			<span>No scenario names this entity, so nothing proves it here.</span>
		</p>
	{/if}
	{#each coverage as scenario, position (position)}
		<section class="ex-card" aria-label={scenario.title}>
			<h2>{scenario.title}</h2>
			<p>
				<HarnessVerdict
					passed={scenario.standing === 'passed'}
					label={scenario.standing === 'passed'
						? 'Every required state is proven'
						: said[scenario.standing]}
					reasons={scenario.reasons}
				/>
			</p>
			<p class="ex-soft">
				{scenario.kind} scenario{scenario.inheritedFrom
					? ` · result inherited from ${shortCommit(scenario.inheritedFrom)}`
					: ''}
			</p>
			{#if scenario.reasons.length}
				<ul class="ex-reasons" aria-label={`Why ${scenario.title} is not proven`}>
					{#each scenario.reasons as reason}<li>{reason}</li>{/each}
				</ul>
			{/if}
			<div class="ex-scroll">
				<table class="ex-mini" aria-label={`States of ${scenario.title}`}>
					<thead>
						<tr>
							<th scope="col">State</th>
							<th scope="col">Required</th>
							<th scope="col">Proven</th>
						</tr>
					</thead>
					<tbody>
						{#each scenario.states as state}
							<tr>
								<th scope="row">{state.state}</th>
								<td
									>{state.declared}{declared(scenario.scenario, state.state)
										? `: ${declared(scenario.scenario, state.state)}`
										: ''}</td
								>
								<td>
									{#if state.standing === 'inapplicable'}
										<span class="ex-soft">{said.inapplicable}</span>
									{:else}
										<HarnessVerdict
											passed={state.standing === 'passed'}
											label={said[state.standing]}
											reasons={state.reasons}
										/>
									{/if}
									<!-- Sentences and slots in the order the host gave them; none is a key. -->
									{#each state.reasons as reason}
										<span class="ex-soft ex-block">{reason}</span>
									{/each}
									<!-- A slot is told where the state has not already said the same of it. -->
									{#each state.slots.filter((slot) => untold(state.reasons, slot)) as slot}
										<span class="ex-soft ex-block"
											>{where(slot)}: {slot.reason ?? said[slot.standing]}</span
										>
									{/each}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<ul class="ex-checks" aria-label="Checks">
				{#each scenario.tests as test}
					<li>
						<HarnessVerdict
							passed={test.status === 'passed'}
							label={test.status ?? 'not in the record'}
						/>
						<span>{test.id}</span>
						<span class="ex-soft">{test.status ?? 'not in the record'}</span>
						{#if job(scenario.scenario, test.id)}
							<span class="ex-soft"
								>{job(scenario.scenario, test.id)?.kind} · {job(scenario.scenario, test.id)
									?.durationMs} ms</span
							>
						{/if}
					</li>
				{/each}
			</ul>
			{#each scenario.tests as check, position (position)}<BrowserErrors
					diagnostics={check.browserErrors}
				/>{/each}
		</section>
	{/each}
	{#if gone.length}
		<section class="ex-card" aria-label="No longer declared">
			<h2>No longer declared at {shortCommit(scope.commit)}</h2>
			<p class="ex-soft">
				What {shortCommit(scope.parent ?? '')} declared and this commit does not: it has a result before
				and none after.
			</p>
			<ul class="ex-reasons">
				{#each gone as item}<li>{item}</li>{/each}
			</ul>
		</section>
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
</div>
