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
				<header class="ex-group-head">
					<h2 title={section.source}>
						{section.title} <span class="ex-group-count">{section.rows.length}</span>
					</h2>
				</header>
				{@render list(section.rows)}
			</section>
		{/each}
	{:else}
		{@render list(listed)}
	{/if}
	{#if category !== 'functions' && category !== 'models' && category !== 'types' && category !== 'configs'}<footer
			class="ex-legend"
		>
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
		margin-top: var(--hx-space-28);
	}
	/* The source config's name and variable count form one compact section heading. */
	.ex-group-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--hx-space-4) var(--hx-space-16);
		margin: 0 0 var(--hx-space-12);
		padding-bottom: var(--hx-space-8);
		border-bottom: var(--hx-border-thin) solid var(--hx-line);
	}
	.ex-group h2 {
		margin: 0;
		color: var(--hx-text);
		font-size: var(--hx-type-size-lg);
		font-weight: var(--hx-style-weight-semibold);
		line-height: var(--hx-style-leading-snug);
		overflow-wrap: anywhere;
	}
	.ex-group-count {
		margin-inline-start: var(--hx-space-4);
		color: var(--hx-muted);
		font-size: var(--hx-type-size-compact);
		font-weight: var(--hx-style-weight-regular);
		font-variant-numeric: var(--hx-style-numeric-tabular);
		white-space: nowrap;
	}
</style>
