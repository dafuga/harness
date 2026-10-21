<script lang="ts">
	import type { ExplorerCategory } from '../models/Explorer.types';
	import type { CatalogRow } from '../utils/entityCatalog';
	import type { EntityLens, EntityNav } from '../utils/entityLens';
	import { catalogShot } from '../utils/entityScreens';
	import ExplorerFunctionCard from './ExplorerFunctionCard.svelte';
	import ExplorerPageCard from './harness/ExplorerPageCard.svelte';
	import ExplorerTable from './harness/ExplorerTable.svelte';
	let {
		category,
		rows,
		nav,
		lens,
		mediaBase,
		verification = true
	}: {
		category: ExplorerCategory;
		rows: CatalogRow[];
		nav: EntityNav;
		lens: EntityLens;
		mediaBase: string;
		verification?: boolean;
	} = $props();
</script>

{#if category === 'pages' || category === 'components' || category === 'functions'}
	<div class={category === 'pages' ? 'ex-page-grid' : 'ex-catalog-grid'}>
		{#each rows as row (row.id)}
			{#if category === 'pages' || category === 'components'}
				<ExplorerPageCard
					{row}
					{category}
					{nav}
					{lens}
					{mediaBase}
					{verification}
					shot={catalogShot(lens.evidence(row.entity.unit), row.entity.unit.preview)}
				/>
			{:else}<ExplorerFunctionCard {row} {nav} {lens} {mediaBase} />{/if}
		{/each}
	</div>
{:else}
	<ExplorerTable {category} {rows} {nav} {lens} {mediaBase} {verification} />
{/if}

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
