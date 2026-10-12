<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import type { EntityNav } from '../../utils/entityLens';
	import { entityShown } from '../../utils/entityShown';
	import EntityOverview from './EntityOverview.svelte';
	import EntityRelations from './EntityRelations.svelte';
	import EntityTests from './EntityTests.svelte';
	let {
		host,
		entity,
		nav,
		pane
	}: {
		host: ExplorerScreenProps;
		entity: ExplorerEntity;
		nav: EntityNav;
		/** The evidence an entity of this kind is first shown with, under its summary. */
		pane: Snippet;
	} = $props();
	let relations = $derived(host.lens.relations(entity.id));
	let summary = $derived(entityShown(host, entity));
</script>

<!-- The tab of the address decides which of the three an entity screen shows. -->
{#if host.route.tab === 'relationships'}
	<div role="tabpanel" aria-label={`${entity.name} relationships`}>
		<EntityRelations {relations} {nav} />
	</div>
{:else if host.route.tab === 'tests'}
	<EntityTests
		{entity}
		scope={host.scope}
		evidence={host.lens.evidence(entity.unit)}
		behavior={host.lens.behavior(entity.unit)}
		{nav}
		mediaBase={host.mediaBase}
		exportHref={host.exportHref}
	/>
{:else}
	<EntityOverview {entity} {relations} contract={summary.contract} measure={summary.measure} {nav}>
		{@render pane()}
	</EntityOverview>
{/if}
