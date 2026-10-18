<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import type { EntityNav } from '../../utils/entityLens';
	import { entityShown } from '../../utils/entityShown';
	import EntityContract from '../EntityContract.svelte';
	import EntityOverview from './EntityOverview.svelte';
	import EntityRelations from './EntityRelations.svelte';
	import EntityTests from './EntityTests.svelte';
	import EntityStates from '../EntityStates.svelte';
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
		<EntityRelations relations={host.lens.relations(entity.id)} {nav} show={direction} {removed} />
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
			<details><summary>Verification details</summary>{@render verification()}</details>
		</div>
	{:else}{@render verification()}{/if}
{:else if host.route.tab === 'contract'}
	<div role="tabpanel" aria-label={`${entity.name} contract`}>
		<EntityContract unit={entity.unit} category={entity.category} {contract} last={entity.lastAt} />
	</div>
{:else}
	<EntityOverview {entity} measure={summary.measure}>
		{@render pane()}
	</EntityOverview>
{/if}

{#snippet verification()}
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
