<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import { explorerEntity } from '../../utils/explorerEntities';
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
	let listed = $derived(host.entities.find((item) => item.id === host.route.entity));
	let moduleEntity = $derived.by(() => {
		if (listed) return listed;
		const unit = host.head.registry.units.find(
			(item) => item.id === host.route.entity && item.status === 'active'
		);
		return unit ? (explorerEntity(host.head, unit, true) ?? undefined) : undefined;
	});
	let entity = $derived(helperEntity(moduleEntity, host.route.helper));
	let choosing = $derived(
		moduleEntity?.category === 'functions' &&
			!host.route.helper &&
			(moduleEntity.unit.helpers?.length ?? 0) > 1
	);
	let owner = $derived.by(() => {
		if (!entity || listed) return undefined;
		const related = host.lens.relations(entity.id);
		if (related.usedBy.length === 1) return related.usedBy[0];
		return related.usedBy.length === 0 && related.pages.length === 1 ? related.pages[0] : undefined;
	});
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
		{#if choosing && moduleEntity}
			<section class="ex-card">
				<h1>{moduleEntity.name}</h1>
				<p>Choose a helper to open its own detail page.</p>
				<ul class="ex-links">
					{#each moduleEntity.unit.helpers ?? [] as helper}
						<li>
							<EntityLink
								{nav}
								to={entityLens(host.route, {
									entity: moduleEntity.id,
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
				{owner}
				{nav}
				shared={isShared(host.lens.relations(entity.id), entity.unit)}
				preview={screens}
			/>
			{@render screen(entity, nav)}
		{:else}
			<EntityMissing
				title="Not at this revision"
				message={host.route.helper && !host.route.entity
					? `The name ${host.route.helper} does not identify exactly one helper at this revision. Choose its owner from Helpers.`
					: `Nothing named ${host.route.helper ?? host.route.entity} is in the registry at ${shortCommit(host.scope.commit)}.`}
				{nav}
				to={entityLens(host.route, { category: host.route.category })}
			/>
		{/if}
	{/snippet}
</ExplorerFrame>
