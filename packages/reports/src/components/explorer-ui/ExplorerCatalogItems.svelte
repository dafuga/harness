<script lang="ts">
	import { tick } from 'svelte';
	import type { ExplorerCategory } from '../../models/Explorer.types';
	import type { CatalogRow } from '../../utils/entityCatalog';
	import type { EntityLens, EntityNav } from '../../utils/entityLens';
	import type { Row } from './ExplorerCatalogItems.types';
	import ExplorerModuleCard from './ExplorerModuleCard.svelte';
	import ExplorerTable from './ExplorerTable.svelte';
	import HarnessAction from './HarnessAction.svelte';
	let {
		category,
		rows,
		nav,
		lens,
		mediaBase,
		verification = true,
		batch = 0,
		label = category ?? 'Other'
	}: {
		/** The collection listed; null for what a module uses that no collection lists. */
		category: ExplorerCategory | null;
		rows: Row[];
		nav: EntityNav;
		lens: EntityLens;
		mediaBase: string;
		verification?: boolean;
		batch?: number;
		label?: string;
	} = $props();
	// Settings are variables with values, not modules: they keep their table of values. Every
	// module, a config or layout included, is the one module card.
	const setting = (row: Row): row is CatalogRow => !('support' in row) && Boolean(row.setting);
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

{#snippet items(rows: Row[])}
	{#if category === 'configs' && rows.every(setting)}
		<ExplorerTable category="configs" {rows} {nav} {lens} {mediaBase} {verification} />
	{:else}
		<div class={category === 'pages' ? 'ex-page-grid' : 'ex-catalog-grid'}>
			{#each rows as row (row.id)}
				<ExplorerModuleCard {row} {category} {nav} {lens} {mediaBase} />
			{/each}
		</div>
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
		gap: var(--hx-space-14);
		min-width: 0;
	}
	/* Three tiles across a desktop, two on a tablet, one on a phone; a lone tile stays a tile. */
	.ex-catalog-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: var(--hx-space-18);
		min-width: 0;
	}
</style>
