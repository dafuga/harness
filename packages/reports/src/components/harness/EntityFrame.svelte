<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import { isShared } from '../../utils/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import { entityLens, shortCommit, type EntityNav } from '../../utils/entityLens';
	import { screenOptions } from '../../utils/entityScreens';
	import { entityChanged } from '../../utils/entityShown';
	import EntityHeader from './EntityHeader.svelte';
	import EntityMissing from './EntityMissing.svelte';
	import EntityScreens from './EntityScreens.svelte';
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
		<!-- A component keeps the screenshots of its revision between its name and every row of tabs. -->
		{#snippet screens()}
			{#if entity?.category === 'components'}
				{@const evidence = host.lens.evidence(entity.unit)}
				<EntityScreens
					options={screenOptions(evidence.scenarios)}
					{evidence}
					scope={host.scope}
					mediaBase={host.mediaBase}
					{nav}
					reasons={entityChanged(host, entity.id)}
				/>
			{/if}
		{/snippet}
		{#if entity}
			<EntityHeader
				{entity}
				{nav}
				shared={isShared(host.lens.relations(entity.id))}
				preview={screens}
			/>
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
