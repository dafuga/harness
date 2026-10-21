<script lang="ts">
	import { entityCatalog, type CatalogRow } from '../../../utils/explorer-ui/entityCatalog';
	import type { EntityNav } from '../../../utils/explorer-ui/entityLens';
	import type { ExplorerScreenProps } from '../../../models/explorer-ui/ExplorerScreen.types';
	import { catalogShot } from '../../../utils/explorer-ui/entityScreens';
	import ExplorerFunctionCard from '../ExplorerFunctionCard.svelte';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import ExplorerIndex from './explorer-index/ExplorerIndex.svelte';
	import ExplorerPageCard from './ExplorerPageCard.svelte';
	import ExplorerTable from './ExplorerTable.svelte';
	let host: ExplorerScreenProps = $props();
	let category = $derived(host.route.category);
	let rows = $derived(entityCatalog(host.entities, category, host.lens.relations));
	let tiled = $derived(['components', 'functions', 'services'].includes(category));
</script>

<!-- Components show screenshots; helpers and services show their name or call and usage. -->
{#snippet tile(row: CatalogRow, nav: EntityNav)}
	{#if category === 'components'}
		<ExplorerPageCard
			{row}
			category="components"
			shot={catalogShot(host.lens.evidence(row.entity.unit), row.entity.unit.preview)}
			mediaBase={host.mediaBase}
			{nav}
		/>
	{:else}
		<ExplorerFunctionCard {row} {nav} />
	{/if}
{/snippet}

<!-- Components, helpers and services share one grid; shells, configs and models keep tables. -->
<ExplorerFrame {host}>
	{#snippet children(nav)}
		<ExplorerIndex {category} {rows}>
			{#snippet list(listed)}
				<!-- Pages are cards on a screen of their own; this one draws the five other kinds. -->
				{#if tiled}
					<div class="ex-catalog-grid">
						{#each listed as row (row.id)}
							{@render tile(row, nav)}
						{/each}
					</div>
				{:else if category !== 'pages'}
					<ExplorerTable {category} rows={listed} {nav} />
				{/if}
			{/snippet}
		</ExplorerIndex>
	{/snippet}
</ExplorerFrame>

<style>
	/* Three tiles across a desktop, two on a tablet, one on a phone; a lone tile stays a tile. */
	.ex-catalog-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: 18px;
		min-width: 0;
	}
	/* A component card of this grid only: its capture above its words, its open action at the foot. */
	.ex-catalog-grid :global(.ex-page-card) {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto 1fr;
		gap: 14px;
		min-width: 0;
	}
	.ex-catalog-grid :global(.ex-page-body) {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
	}
	.ex-catalog-grid :global(.ex-page-body h2) {
		font-size: 1.2rem;
	}
	.ex-catalog-grid :global(.ex-page-body > .ex-open-page) {
		align-self: flex-end;
		margin-top: auto;
	}
</style>
