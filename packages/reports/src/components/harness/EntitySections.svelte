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
		/** The evidence an entity of this kind is shown with: above its summary when it is seen. */
		pane: Snippet;
	} = $props();
	let summary = $derived(entityShown(host, entity));
	const said = { 'used-in': 'used in', uses: 'uses' } as const;
	let direction = $derived(
		host.route.tab === 'used-in' || host.route.tab === 'uses' ? host.route.tab : null
	);
	let removed = $derived(entity.change === 'removed');
</script>

<!-- The tab of the address decides what an entity screen shows; any other shows its overview. -->
{#if direction}
	<div role="tabpanel" aria-label={`${entity.name} ${said[direction]}`}>
		<EntityRelations relations={host.lens.relations(entity.id)} {nav} show={direction} {removed} />
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
	<EntityOverview {entity} contract={summary.contract} measure={summary.measure}>
		{@render pane()}
	</EntityOverview>
{/if}
