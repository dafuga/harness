<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerCategory } from '../../models/Explorer.types';
	import { catalogFilter, type CatalogFilter, type CatalogRow } from '../../utils/entityCatalog';
	import { entityLabels } from '../../utils/entityLens';
	import { categoryIcon } from '../../utils/harnessIcons';
	import ExplorerControls from './ExplorerControls.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessVerdict from './HarnessVerdict.svelte';
	let {
		category,
		rows,
		list
	}: {
		category: ExplorerCategory;
		/** Every entity of the category at the shown revision, before any filter. */
		rows: CatalogRow[];
		/** How the listed entities of this kind are drawn: cards for pages, a table otherwise. */
		list: Snippet<[CatalogRow[]]>;
	} = $props();
	let filter = $state<CatalogFilter>({ search: '', changedOnly: false, order: 'name' });
	let label = $derived(entityLabels[category]);
	let noun = $derived(label.title.toLowerCase());
	let listed = $derived(catalogFilter(rows, filter));
	let filtered = $derived(Boolean(filter.search.trim()) || filter.changedOnly);
</script>

<section class="ex-index" aria-labelledby="ex-index-title">
	<nav class="ex-crumbs" aria-label="Breadcrumb">
		<ol>
			<li><HarnessIcon name={categoryIcon[category]} size={18} /></li>
			<li aria-current="page">{label.title}</li>
		</ol>
	</nav>
	<h1 id="ex-index-title">{label.title}</h1>
	<p class="ex-lead">{label.subtitle}</p>
	{#if category === 'components'}
		<p class="ex-soft">A component can contain other components.</p>
	{:else if category === 'shells'}
		<p class="ex-soft">A shell frames the pages of a host and holds the components they show.</p>
	{/if}
	<ExplorerControls {noun} bind:filter />
	<p class="ex-hidden" role="status">{listed.length} of {rows.length} {noun} shown</p>
	{#if rows.length === 0}
		<p class="ex-empty">No {noun} are in the registry of this revision.</p>
	{:else if listed.length === 0}
		<p class="ex-empty">
			No {noun} match{filtered ? ' this search' : ''}.
			<button
				type="button"
				class="ex-text-button"
				onclick={() => (filter = { ...filter, search: '', changedOnly: false })}
				>Show all {noun}</button
			>
		</p>
	{:else}
		{@render list(listed)}
	{/if}
	<footer class="ex-legend">
		{#if category === 'pages'}
			<p class="ex-hint">
				<HarnessIcon name="relationships" size={26} />
				<span>
					<strong>Page → Components → Functions &amp; services</strong>
					<span class="ex-soft ex-block"
						>Start from a page, explore its components, then the functions and services they use.</span
					>
				</span>
			</p>
		{/if}
		<!-- The two marks as every row shows them: each tells what it means when it is asked. -->
		<p class="ex-key">
			<HarnessVerdict passed={true} label="Proven" />
			<HarnessVerdict
				passed={false}
				label="Not proven"
				reasons={['A required test, state or capture failed, is missing, is stale or is unknown.']}
			/>
			<span class="ex-soft">Hover, focus or tap a mark to read why.</span>
		</p>
	</footer>
</section>
