<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerCategory } from '../../../models/explorer-ui/Explorer.types';
	import { catalogFilter } from './entityCatalog';
	import { catalogSections, configSections } from './catalogGroups';
	import { type CatalogFilter, type CatalogRow } from '../../../utils/explorer-ui/entityCatalog';
	import { entityLabels } from '../../../utils/explorer-ui/entityLens';
	import { categoryIcon } from '../../../utils/explorer-ui/harnessIcons';
	import ExplorerControls from '../ExplorerControls.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
	import HarnessGroup from '../HarnessGroup.svelte';
	let {
		category,
		rows,
		scope = '',
		list
	}: {
		category: ExplorerCategory;
		/** Every entity of the category at the shown revision, before any filter. */
		rows: CatalogRow[];
		scope?: string;
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
		'models',
		'types'
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
	// Configs are one section for each source file; every other kind is grouped by responsibility.
	let sections = $derived(
		grouped.has(category)
			? (category === 'configs' ? configSections : catalogSections)(listed).filter(
					(section) => section.rows.length
				)
			: []
	);
	let filtered = $derived(Boolean(filter.search.trim()));
	let resetKey = $derived(JSON.stringify([scope, category, filter]));
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
				<HarnessGroup
					title={section.title}
					count={section.rows.length}
					source={section.source}
					{resetKey}
				>
					{@render list(section.rows)}
				</HarnessGroup>
			</section>
		{/each}
	{:else}
		{@render list(listed)}
	{/if}
</section>

<style>
	.ex-group {
		margin-top: var(--hx-space-28);
	}
</style>
