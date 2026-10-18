<script lang="ts">
	import type { CatalogRow } from '../utils/entityCatalog';
	import { entityLens, type EntityNav } from '../utils/entityLens';
	import EntityLink from './harness/EntityLink.svelte';
	import HarnessIcon from './harness/HarnessIcon.svelte';
	let { row, nav }: { row: CatalogRow; nav: EntityNav } = $props();
	const open = 'Open function';
	let to = $derived(entityLens(nav.route, { category: 'functions', entity: row.id }));
	let summary = $derived.by(() => {
		const characters = Array.from(row.summary);
		if (characters.length <= 80) return row.summary;
		const prefix = characters.slice(0, 79).join('').trimEnd();
		return (prefix.replace(/\s+\S*$/, '') || prefix) + '…';
	});
</script>

<article class="ex-function-tile" aria-label={row.name}>
	<h2><EntityLink {to} {nav}>{row.name}</EntityLink></h2>
	<p class="ex-soft">{summary}</p>
	<EntityLink {to} {nav} class="hx-action gold ex-function-open" label={open} title={open}>
		<HarnessIcon name="arrow-right" size={18} />
	</EntityLink>
</article>

<style>
	.ex-function-tile {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 36px;
		align-content: start;
		align-items: center;
		gap: 10px 16px;
		min-width: 0;
		padding: 16px;
		border: 1px solid var(--ex-line);
		border-radius: var(--ex-radius);
		background: var(--ex-surface);
	}
	.ex-function-tile h2 {
		font-size: 1.1rem;
		overflow-wrap: anywhere;
	}
	.ex-function-tile p {
		grid-column: 1 / -1;
		overflow-wrap: anywhere;
	}
	.ex-function-tile :global(.ex-function-open) {
		grid-column: 2;
		grid-row: 1;
		width: 36px;
		height: 36px;
		min-height: 36px;
		padding: 8px;
	}
</style>
