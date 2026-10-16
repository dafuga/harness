<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import { isShared } from '../../utils/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import { entityLens, shortCommit, type EntityNav } from '../../utils/entityLens';
	import EntityHeader from './EntityHeader.svelte';
	import EntityMissing from './EntityMissing.svelte';
	import ExplorerFrame from './ExplorerFrame.svelte';
	let {
		host,
		children: screen
	}: {
		host: ExplorerScreenProps;
		/** The screen of the entity the address names, once the revision is found to hold it. */
		children: Snippet<[ExplorerEntity, EntityNav]>;
	} = $props();
	let entity = $derived(host.entities.find((item) => item.id === host.route.entity));
</script>

<ExplorerFrame {host}>
	{#snippet children(nav)}
		{#if entity}
			<EntityHeader {entity} {nav} shared={isShared(host.lens.relations(entity.id))} />
			{@render screen(entity, nav)}
		{:else}
			<EntityMissing
				title="Not at this revision"
				message={`Nothing named ${host.route.entity} is in the registry at ${shortCommit(host.scope.commit)}.`}
				{nav}
				to={entityLens(host.route, { category: host.route.category })}
			/>
		{/if}
	{/snippet}
</ExplorerFrame>
