<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../../models/Explorer.types';
	import type { ExplorerScreenProps } from '../../../models/ExplorerScreen.types';
	import type { EntityNav } from '../../../utils/entityLens';
	import { entityShown } from './entityShown';
	import EntityContract from '../../entity-contract/EntityContract.svelte';
	import EntitySource from '../EntitySource.svelte';
	import EntityOverview from '../EntityOverview.svelte';
	import EntityRelations from '../entity-relations/EntityRelations.svelte';
	import EntityTests from '../entity-tests/EntityTests.svelte';
	import EntityStates from '../../EntityStates.svelte';
	import EntityExamples from '../../EntityExamples.svelte';
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
	const said = { 'used-in': 'used in', uses: 'uses' } as const;
	let direction = $derived(
		host.route.tab === 'used-in' || host.route.tab === 'uses' ? host.route.tab : null
	);
	let removed = $derived(entity.change === 'removed');
	let visual = $derived(['pages', 'components', 'shells'].includes(entity.category));
	// The purpose is the sentence under the name of an overview tab; it is not said twice there.
	let contract = $derived(summary.contract.filter((row) => row.label !== 'Purpose'));
</script>

<!-- The tab of the address decides what an entity screen shows; any other shows its overview. -->
{#if direction}
	<div role="tabpanel" aria-label={`${entity.name} ${said[direction]}`}>
		<EntityRelations
			{host}
			relations={host.lens.relations(entity.id)}
			{nav}
			show={direction}
			{removed}
		/>
	</div>
{:else if entity.category === 'functions' && (host.route.tab === 'examples' || host.route.tab === 'tests')}
	<div role="tabpanel" aria-label={`${entity.name} examples`} class="ex-stack">
		<EntityExamples documentation={entity.unit.documentation} />
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
			repository={host.index.sourceRepository}
			commit={entity.lastAt ?? host.scope.commit}
		/>
	</div>
{:else if host.route.tab === 'contract'}
	<div role="tabpanel" aria-label={`${entity.name} contract`}>
		<EntityContract unit={entity.unit} category={entity.category} {contract} last={entity.lastAt} />
	</div>
{:else}
	<EntityOverview {entity} measure={summary.measure}>
		{@render pane()}
	</EntityOverview>
{/if}

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
