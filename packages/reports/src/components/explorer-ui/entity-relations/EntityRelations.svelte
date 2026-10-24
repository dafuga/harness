<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type {
		ExplorerEntity,
		ExplorerRelations,
		ExplorerSupport
	} from '../../../models/explorer-ui/Explorer.types';
	import { explorerKindCategory } from '../../../../../../src/utils/explorerRoute';
	import type { EntityNav } from '../../../utils/explorer-ui/entityLens';
	import type { SupportRow } from '../../../utils/explorer-ui/entityUsage';
	import { entityUsage } from './entityUsage';
	import { entityCatalog } from '../../../utils/explorer-ui/entityCatalog';
	import type { ExplorerScreenProps } from '../../../models/explorer-ui/ExplorerScreen.types';
	import ExplorerCatalogItems from '../../ExplorerCatalogItems.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
	import HarnessGroup from '../HarnessGroup.svelte';
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
		show?: 'both' | 'used-in' | 'uses' | 'models';
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
	/** A dependency no collection lists, on its card: its own name and what uses it, as a row has. */
	const supportRow = (support: ExplorerSupport): SupportRow => {
		const related = host.lens.relations(support.id);
		return {
			support,
			id: support.id,
			name: support.name,
			usedIn: [...related.usedBy, ...related.pages].filter((user) => user.change !== 'removed'),
			// A private function keeps its existing page; no other kind or page is made up for it.
			opens: explorerKindCategory(support.unit.kind) === 'functions' ? 'functions' : null
		};
	};
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
					consumers: host.entities,
					revision: host.head
				})}
			/>
		{/key}
	{/each}
{/snippet}

<!-- What uses the entity and what it uses are two sections; neither names a file. -->
<hx-div class="ex-relations" data-harness-component="harness-entity-relations">
	{#if show === 'models'}
		<hx-section class="ex-card" aria-label="Models">
			<hx-h2>
				<HarnessIcon name="database" size={22} /> Models
				<hx-span class="ex-count">{relations.models?.length ?? 0}</hx-span>
			</hx-h2>
			<hx-p class="ex-soft">
				Data models used by this page, including through its components and services.
			</hx-p>
			{#if !relations.models?.length}
				<hx-p class="ex-soft">
					{removed
						? `${gone}models are unavailable at this revision.`
						: 'No data models are recorded for this page.'}
				</hx-p>
			{:else}
				{@render cards(relations.models, 'Models')}
			{/if}
		</hx-section>
	{/if}
	{#if show === 'both' || show === 'used-in'}
		<hx-section class="ex-card" aria-label="Used In">
			<hx-h2>
				<HarnessIcon name="relationships" size={22} /> Used In
				<hx-span class="ex-count">{usage.usedIn.length}</hx-span>
			</hx-h2>
			{#if usage.usedIn.length === 0}
				<hx-p class="ex-soft">
					{removed
						? `${gone}nothing of this commit uses it.`
						: 'No page shows it and nothing else uses it.'}
				</hx-p>
			{/if}
			{#each usage.usedInGroups as group (group.title)}
				<HarnessGroup
					title={group.title}
					count={group.items.length}
					icon={group.icon}
					level={3}
					variant="relation"
					resetKey={scope}
				>
					{@render cards(group.items, `${group.title} used in`)}
				</HarnessGroup>
			{/each}
		</hx-section>
	{/if}
	{#if show === 'both' || show === 'uses'}
		<hx-section class="ex-card" aria-label="Uses">
			<hx-h2>
				<HarnessIcon name="layers" size={22} /> Uses
				<hx-span class="ex-count">{usage.count}</hx-span>
			</hx-h2>
			{#if usage.count === 0}
				<hx-p class="ex-soft">
					{removed
						? `${gone}what it used is not listed here.`
						: 'It uses no component, function, config or service.'}
				</hx-p>
			{/if}
			{#each usage.uses as group, position (position)}
				<HarnessGroup
					title={group.title}
					count={group.items.length}
					icon={group.icon}
					level={3}
					variant="relation"
					resetKey={scope}
				>
					{@render cards(group.items, `${group.title} uses`)}
				</HarnessGroup>
			{/each}
			{#if usage.other.length}
				<HarnessGroup
					title="Other"
					count={usage.other.length}
					icon="file"
					level={3}
					variant="relation"
					resetKey={scope}
				>
					{#key scope}
						<ExplorerCatalogItems
							category={null}
							{nav}
							lens={host.lens}
							mediaBase={host.mediaBase}
							verification={false}
							batch={4}
							label="Other uses"
							rows={usage.other.map(supportRow)}
						/>
					{/key}
				</HarnessGroup>
			{/if}
		</hx-section>
	{/if}
</hx-div>
