<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import { isShared } from '../../utils/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import { entityLens, shortCommit, type EntityNav } from '../../utils/entityLens';
	import { screenOptions } from '../../utils/entityScreens';
	import { entityChanged, helperEntity } from '../../utils/entityShown';
	import EntityLink from './EntityLink.svelte';
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
	let owner = $derived(host.entities.find((item) => item.id === host.route.entity));
	let entity = $derived(helperEntity(owner, host.route.helper));
	let choosing = $derived(
		owner?.category === 'functions' && !host.route.helper && (owner.unit.helpers?.length ?? 0) > 1
	);
</script>

<ExplorerFrame {host}>
	{#snippet children(nav)}
		<!-- A component keeps the screenshots of its revision between its name and every row of tabs. -->
		{#snippet screens()}
			{#if entity?.category === 'components'}
				{@const evidence = host.lens.evidence(entity.unit)}
				<EntityScreens
					options={screenOptions(evidence.scenarios)}
					preview={entity.unit.preview}
					{evidence}
					scope={host.scope}
					mediaBase={host.mediaBase}
					{nav}
					reasons={entityChanged(host, entity.id)}
				/>
			{/if}
		{/snippet}
		{#if choosing && owner}
			<section class="ex-card">
				<h1>{owner.name}</h1>
				<p>Choose a helper to open its own detail page.</p>
				<ul class="ex-links">
					{#each owner.unit.helpers ?? [] as helper}
						<li>
							<EntityLink
								{nav}
								to={entityLens(host.route, {
									entity: owner.id,
									helper: helper.name,
									tab: 'contract'
								})}><code>{helper.name}()</code></EntityLink
							>
						</li>
					{/each}
				</ul>
			</section>
		{:else if entity}
			<EntityHeader
				{entity}
				{nav}
				shared={isShared(host.lens.relations(entity.id), entity.unit)}
				preview={screens}
			/>
			{#if host.route.helper}<p class="ex-note">
					Size, complexity, history, relationships and verification describe the owning module.
				</p>{/if}
			{@render screen(entity, nav)}
		{:else}
			<EntityMissing
				title="Not at this revision"
				message={`Nothing named ${host.route.helper ?? host.route.entity} is in the registry at ${shortCommit(host.scope.commit)}.`}
				{nav}
				to={entityLens(host.route, { category: host.route.category })}
			/>
		{/if}
	{/snippet}
</ExplorerFrame>
