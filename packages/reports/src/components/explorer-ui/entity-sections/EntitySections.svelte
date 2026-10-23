<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../../models/explorer-ui/Explorer.types';
	import type { ExplorerScreenProps } from '../../../models/explorer-ui/ExplorerScreen.types';
	import type { EntityNav } from '../../../utils/explorer-ui/entityLens';
	import { entityMetricComparison } from '../../../utils/explorer-ui/entityMetricComparison';
	import { entityShown } from './entityShown';
	import { helperRelations } from '../../../utils/explorer-ui/entityShown';
	import EntityContract from '../entity-contract/EntityContract.svelte';
	import EntitySource from '../EntitySource.svelte';
	import EntityOverview from '../EntityOverview.svelte';
	import EntityRelations from '../entity-relations/EntityRelations.svelte';
	import EntityTests from '../entity-tests/EntityTests.svelte';
	import EntityStates from '../EntityStates.svelte';
	import EntityExamples from '../EntityExamples.svelte';
	import EntityAudio from '../EntityAudio.svelte';
	let {
		host,
		entity,
		nav,
		pane
	}: {
		host: ExplorerScreenProps;
		entity: ExplorerEntity;
		nav: EntityNav;
		/** The evidence an entity of this kind is shown with: above its summary when it is seen. */
		pane: Snippet;
	} = $props();
	let summary = $derived(entityShown(host, entity));
	let comparison = $derived(
		entityMetricComparison(host, entity, summary.measure, host.route.helper)
	);
	let relations = $derived(helperRelations(host, entity, host.lens.relations(entity.id)));
	let usesAvailable = $derived(
		!host.route.helper || entity.category !== 'functions' || relations.functions.length > 0
	);
	const said = { 'used-in': 'used in', uses: 'uses' } as const;
	let direction = $derived(
		(host.route.tab === 'used-in' && entity.category !== 'pages') ||
			(host.route.tab === 'uses' && usesAvailable)
			? host.route.tab
			: null
	);
	let removed = $derived(entity.change === 'removed');
	let visual = $derived(['pages', 'components', 'layouts'].includes(entity.category));
	// Functions and services show their authored uses; their former Tests address opens them too.
	let examples = $derived(
		['functions', 'services'].includes(entity.category) &&
			(host.route.tab === 'examples' || host.route.tab === 'tests')
	);
	// The purpose is the sentence under the name of an overview tab; it is not said twice there.
	let contract = $derived(summary.contract.filter((row) => row.label !== 'Purpose'));
</script>

<div class="ex-sections" data-harness-component="harness-entity-sections">
	<!-- The tab of the address decides what an entity screen shows; any other shows its overview. -->
	{#if entity.category === 'pages' && (host.route.tab === 'models' || host.route.tab === 'contract')}
		<div role="tabpanel" aria-label={`${entity.name} models`}>
			<EntityRelations {host} {relations} {nav} show="models" {removed} />
		</div>
	{:else if direction}
		<div role="tabpanel" aria-label={`${entity.name} ${said[direction]}`}>
			<EntityRelations {host} {relations} {nav} show={direction} {removed} />
		</div>
	{:else if examples}
		<div role="tabpanel" aria-label={`${entity.name} examples`} class="ex-stack">
			{#if entity.category === 'services'}
				<!-- Creation leads; recorded verification stays apart from authored uses. -->
				<EntityExamples documentation={entity.unit.documentation} setupTitle="Create the service" />
				<p class="ex-soft">These examples are authored documentation, not test results.</p>
				<details><summary>Verification details</summary>{@render verificationPanel()}</details>
			{:else}
				<EntityExamples documentation={entity.unit.documentation} />
			{/if}
		</div>
	{:else if entity.category === 'components' && host.route.tab === 'audio'}
		<div role="tabpanel" aria-label={`${entity.name} audio`}>
			<EntityAudio
				evidence={host.lens.evidence(entity.unit)}
				scope={host.scope}
				mediaBase={host.mediaBase}
				empty
			/>
		</div>
	{:else if host.route.tab === 'states' || host.route.tab === 'tests'}
		{#if visual}
			<div role="tabpanel" aria-label={`${entity.name} states`}>
				<EntityStates
					name={entity.name}
					evidence={host.lens.evidence(entity.unit)}
					scope={host.scope}
					mediaBase={host.mediaBase}
				/>
				<details><summary>Verification details</summary>{@render verificationPanel()}</details>
			</div>
		{:else}{@render verificationPanel()}{/if}
	{:else if host.route.tab === 'source'}
		<div role="tabpanel" aria-label={`${entity.name} source`}>
			<EntitySource
				unit={entity.unit}
				{entity}
				{nav}
				repository={host.index.sourceRepository}
				commit={entity.lastAt ?? host.scope.commit}
			/>
		</div>
	{:else if host.route.tab === 'contract'}
		<div role="tabpanel" aria-label={`${entity.name} contract`}>
			<EntityContract
				unit={entity.unit}
				category={entity.category}
				{contract}
				last={entity.lastAt}
			/>
		</div>
	{:else}
		<EntityOverview {entity} measure={summary.measure} {comparison}>
			{@render pane()}
		</EntityOverview>
	{/if}
</div>

{#snippet verificationPanel()}
	<EntityTests
		{entity}
		scope={host.scope}
		evidence={host.lens.evidence(entity.unit)}
		behavior={host.lens.behavior(entity.unit)}
		{nav}
		mediaBase={host.mediaBase}
		exportHref={host.exportHref}
	/>
{/snippet}

<style>
	.ex-sections {
		display: contents;
	}
</style>
