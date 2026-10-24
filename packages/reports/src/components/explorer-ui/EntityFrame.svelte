<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../models/explorer-ui/Explorer.types';
	import { explorerEntity } from '../../utils/explorer-ui/explorerEntities';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import { entityLens, type EntityNav } from '../../utils/explorer-ui/entityLens';
	import { shortCommit } from '../../helpers/strings/shortCommit';
	import { screenOptions } from '../../utils/explorer-ui/entityScreens';
	import {
		entityChanged,
		helperEntity,
		helperRelations
	} from '../../utils/explorer-ui/entityShown';
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
		if (unit) return explorerEntity(host.head, unit, true) ?? undefined;
		const parent = host.parent;
		if (!parent || !host.head.sourceImpact?.units.removed.includes(host.route.entity ?? ''))
			return undefined;
		const previous = parent.registry.units.find((item) => item.id === host.route.entity);
		const removed = previous && explorerEntity(parent, previous, true);
		if (!removed) return undefined;
		return {
			...removed,
			change: 'removed' as const,
			lastAt: parent.commit,
			verdict: {
				passed: false,
				label: 'Removed at this commit',
				reasons: [
					`This commit removed it; its contract is shown as it last was, at ${shortCommit(parent.commit)}.`
				]
			}
		};
	});
	let entity = $derived(helperEntity(moduleEntity, host.route.helper));
	let usesAvailable = $derived(
		!entity ||
			!host.route.helper ||
			entity.category !== 'functions' ||
			helperRelations(host, entity, host.lens.relations(entity.id)).functions.length > 0
	);
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

<!-- The marker of the entity's frame draws no box. -->
<hx-div class="ex-entity" data-harness-component="harness-entity-frame">
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
			{#if choosing && moduleEntity}
				<hx-section class="ex-card">
					<hx-h1>{moduleEntity.name}</hx-h1>
					<hx-p>Choose a helper to open its own detail page.</hx-p>
					<hx-ul class="ex-links">
						{#each moduleEntity.unit.helpers ?? [] as helper}
							<hx-li>
								<EntityLink
									{nav}
									to={entityLens(host.route, {
										entity: moduleEntity.id,
										helper: helper.name,
										tab: 'contract'
									})}><hx-code>{helper.name}()</hx-code></EntityLink
								>
							</hx-li>
						{/each}
					</hx-ul>
				</hx-section>
			{:else if entity}
				<EntityHeader {entity} {usesAvailable} {owner} {nav} preview={screens} />
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
</hx-div>

<style>
	.ex-entity {
		display: contents;
	}
</style>
