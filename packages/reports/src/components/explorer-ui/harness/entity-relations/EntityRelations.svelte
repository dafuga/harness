<script lang="ts">
	import type { ExplorerEntity, ExplorerRelations } from '../../../../models/explorer-ui/Explorer.types';
	import { explorerKindCategory } from '../../../../../../../src/utils/explorerRoute';
	import { entityLens, type EntityNav } from '../../../../utils/explorer-ui/entityLens';
	import { entityUsage } from './entityUsage';
	import { entityCatalog } from '../../../../utils/explorer-ui/entityCatalog';
	import type { ExplorerScreenProps } from '../../../../models/explorer-ui/ExplorerScreen.types';
	import ExplorerCatalogItems from '../../../ExplorerCatalogItems.svelte';
	import EntityLink from '../EntityLink.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
	let {
		relations,
		host,
		nav,
		show = 'both',
		removed = false
	}: {
		relations: ExplorerRelations;
		host: ExplorerScreenProps;
		nav: EntityNav;
		/** Which of the two sections is drawn; an overview draws both. */
		show?: 'both' | 'used-in' | 'uses';
		/** The shown commit removed the entity: its revision holds no relation of it. */
		removed?: boolean;
	} = $props();
	let usage = $derived(entityUsage(relations));
	let scope = $derived(
		JSON.stringify([
			nav.route.branch,
			nav.route.commit,
			nav.route.entity,
			nav.route.helper,
			show,
			host.scope.commit
		])
	);
	const gone = 'Removed at this commit: ';
</script>

{#snippet cards(items: ExplorerEntity[], label: string)}
	{#each [...new Set(items.map((item) => item.category))] as category (category)}
		{#key scope}
			<ExplorerCatalogItems
				{category}
				{nav}
				lens={host.lens}
				mediaBase={host.mediaBase}
				verification={false}
				batch={4}
				{label}
				rows={entityCatalog(items, category, host.lens.relations, {
					related: true,
					consumers: host.entities
				})}
			/>
		{/key}
	{/each}
{/snippet}

<!-- What uses the entity and what it uses are two sections; neither names a file. -->
<div class="ex-relations">
	{#if show !== 'uses'}
		<section class="ex-card" aria-label="Used In">
			<h2>
				<HarnessIcon name="relationships" size={22} /> Used In
				<span class="ex-count">{usage.usedIn.length}</span>
			</h2>
			{#if usage.usedIn.length === 0}
				<p class="ex-soft">
					{removed
						? `${gone}nothing of this commit uses it.`
						: 'No page shows it and nothing else uses it.'}
				</p>
			{/if}
			{#each usage.usedInGroups as group (group.title)}
				<h3>
					<HarnessIcon name={group.icon} size={18} />
					{group.title} <span class="ex-count">{group.items.length}</span>
				</h3>
				{@render cards(group.items, `${group.title} used in`)}
			{/each}
		</section>
	{/if}
	{#if show !== 'used-in'}
		<section class="ex-card" aria-label="Uses">
			<h2>
				<HarnessIcon name="layers" size={22} /> Uses
				<span class="ex-count">{usage.count}</span>
			</h2>
			{#if usage.count === 0}
				<p class="ex-soft">
					{removed
						? `${gone}what it used is not listed here.`
						: 'It uses no component, function, config or service.'}
				</p>
			{/if}
			{#each usage.uses as group, position (position)}
				<h3>
					<HarnessIcon name={group.icon} size={18} />
					{group.title} <span class="ex-count">{group.items.length}</span>
				</h3>
				{@render cards(group.items, `${group.title} uses`)}
			{/each}
			{#if usage.other.length}
				<h3>
					<HarnessIcon name="file" size={18} /> Other
					<span class="ex-count">{usage.other.length}</span>
				</h3>
				<ul class="ex-related">
					{#each usage.other as item (item.id)}
						<li>
							<span>
								{#if explorerKindCategory(item.unit.kind) === 'functions'}
									<EntityLink
										to={entityLens(nav.route, { category: 'functions', entity: item.id })}
										{nav}>{item.name}</EntityLink
									>
								{:else}{item.name}{/if}
								<span class="ex-pill">{item.role}</span>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>
