<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerCategory } from '../../../models/explorer-ui/Explorer.types';
	import { catalogFilter } from './entityCatalog';
	import { catalogSections } from './catalogGroups';
	import { type CatalogFilter, type CatalogRow } from '../../../utils/explorer-ui/entityCatalog';
	import { entityLabels } from '../../../utils/explorer-ui/entityLens';
	import { categoryIcon } from '../../../utils/explorer-ui/harnessIcons';
	import ExplorerControls from '../ExplorerControls.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
	import HarnessVerdict from '../harness-verdict/HarnessVerdict.svelte';
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
	/** The kinds whose entities carry a category; any other kind is listed whole. */
	const grouped = new Set<string>([
		'pages',
		'layouts',
		'components',
		'functions',
		'configs',
		'services',
		'models'
	]);
	let filter = $state<CatalogFilter>({
		search: '',
		changedOnly: false,
		order: 'name',
		verification: 'all',
		usage: 'all',
		groups: []
	});
	let label = $derived(entityLabels[category]);
	let noun = $derived(label.title.toLowerCase());
	let listed = $derived(catalogFilter(rows, filter));
	let sections = $derived(
		grouped.has(category) ? catalogSections(listed).filter((section) => section.rows.length) : []
	);
	let filtered = $derived(Boolean(filter.search.trim()));
</script>

<section
	class="ex-index"
	aria-labelledby="ex-index-title"
	data-harness-component="harness-explorer-index"
>
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
	{:else if category === 'layouts'}
		<p class="ex-soft">
			The highlighted child area shows where each page renders within its layout.
		</p>
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
				onclick={() =>
					(filter = {
						...filter,
						search: '',
						changedOnly: false,
						verification: 'all',
						usage: 'all',
						groups: []
					})}>Show all {noun}</button
			>
		</p>
	{:else if sections.length}
		{#each sections as section (section.id)}
			<section class="ex-group">
				<h2>{section.title} <span class="ex-group-count">{section.rows.length}</span></h2>
				{@render list(section.rows)}
			</section>
		{/each}
	{:else}
		{@render list(listed)}
	{/if}
	{#if category !== 'functions' && category !== 'models'}<footer class="ex-legend">
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
					reasons={[
						'A required test, state or capture failed, is missing, is stale or is unknown.'
					]}
				/>
				<span class="ex-soft">Hover, focus or tap a mark to read why.</span>
			</p>
		</footer>{/if}
</section>

<style>
	.ex-group {
		margin-top: 28px;
	}
	.ex-group h2 {
		margin: 0 0 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--hx-line, #2c4259);
		color: var(--hx-text, #f2f5fa);
		font-size: 17px;
		font-weight: 600;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}
	.ex-group-count {
		margin-inline-start: 4px;
		color: var(--hx-muted, #8fa1b8);
		font-size: 13px;
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
