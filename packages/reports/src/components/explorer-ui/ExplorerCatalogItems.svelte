<script lang="ts">
	import { tick } from 'svelte';
	import type { ExplorerCategory } from '../../models/Explorer.types';
	import type { CatalogRow } from '../../utils/entityCatalog';
	import type { EntityLens, EntityNav } from '../../utils/entityLens';
	import { catalogShot } from '../../utils/entityScreens';
	import ExplorerFunctionCard from '../ExplorerFunctionCard.svelte';
	import ExplorerPageCard from '../harness/ExplorerPageCard.svelte';
	import ExplorerTable from '../harness/ExplorerTable.svelte';
	import HarnessAction from '../harness/HarnessAction.svelte';
	let {
		category,
		rows,
		nav,
		lens,
		mediaBase,
		verification = true,
		batch = 0,
		label = category
	}: {
		category: ExplorerCategory;
		rows: CatalogRow[];
		nav: EntityNav;
		lens: EntityLens;
		mediaBase: string;
		verification?: boolean;
		batch?: number;
		label?: string;
	} = $props();
	let pages = $state(1);
	let root = $state<HTMLDivElement>();
	let visible = $derived(batch > 0 ? rows.slice(0, pages * batch) : rows);
	async function more() {
		const first = visible.length;
		pages += 1;
		await tick();
		root
			?.querySelectorAll('article, tbody tr')
			[first]?.querySelector<HTMLAnchorElement>('a[href]')
			?.focus();
	}
</script>

{#snippet items(rows: CatalogRow[])}
	{#if category === 'pages' || category === 'components' || category === 'functions' || category === 'models' || category === 'services'}
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
{/snippet}

{#if batch > 0}
	<div class="ex-batched-catalog" role="group" aria-label={label} bind:this={root}>
		{@render items(visible)}
		{#if visible.length < rows.length}
			<HarnessAction tone="plain" label={`View more ${label.split(' ')[0]}`} onclick={more}
				>View More</HarnessAction
			>
		{/if}
	</div>
{:else}
	{@render items(rows)}
{/if}

<style>
	.ex-batched-catalog {
		display: grid;
		gap: 14px;
		min-width: 0;
	}
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
