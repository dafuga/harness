<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
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
	import Select from '../../shared-primitives/Select.svelte';
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
	let composition = $state('all');
	let listed = $derived(
		catalogFilter(rows, filter).filter(
			(row) =>
				category !== 'components' ||
				composition === 'all' ||
				row.entity.unit.composition?.level === composition
		)
	);
	// Configs are one section for each source file; every other kind is grouped by responsibility.
	let sections = $derived(
		grouped.has(category)
			? (category === 'configs' ? configSections : catalogSections)(listed).filter(
					(section) => section.rows.length
				)
			: []
	);
	let filtered = $derived(Boolean(filter.search.trim()));
	let resetKey = $derived(JSON.stringify([scope, category, filter, composition]));
</script>

<hx-section
	class="ex-index"
	aria-labelledby="ex-index-title"
	data-harness-component="harness-explorer-index"
>
	<hx-nav class="ex-crumbs" aria-label="Breadcrumb">
		<hx-ol>
			<hx-li><HarnessIcon name={categoryIcon[category]} size={18} /></hx-li>
			<hx-li aria-current="page">{label.title}</hx-li>
		</hx-ol>
	</hx-nav>
	<hx-h1 id="ex-index-title">{label.title}</hx-h1>
	<hx-p class="ex-lead">{label.subtitle}</hx-p>
	{#if category === 'components'}
		<hx-p class="ex-soft">A component can contain other components.</hx-p>
	{:else if category === 'layouts'}
		<hx-p class="ex-soft">
			The highlighted child area shows where each page renders within its layout.
		</hx-p>
	{/if}
	<ExplorerControls {noun} bind:filter />
	{#if category === 'components'}
		<Select label="Component level" bind:value={composition}>
			<hx-option value="all">All component levels</hx-option>
			<hx-option value="atom">Atoms</hx-option>
			<hx-option value="molecule">Molecules</hx-option>
			<hx-option value="organism">Organisms</hx-option>
			<hx-option value="layout">Layouts</hx-option>
			<hx-option value="page">Pages</hx-option>
		</Select>
	{/if}
	<hx-p class="ex-hidden" role="status">{listed.length} of {rows.length} {noun} shown</hx-p>
	{#if rows.length === 0}
		<hx-p class="ex-empty">No {noun} are in the registry of this revision.</hx-p>
	{:else if listed.length === 0}
		<hx-p class="ex-empty">
			No {noun} match{filtered ? ' this search' : ''}.
			<hx-button
				type="button"
				class="ex-text-button"
				onclick={() => {
					composition = 'all';
					filter = {
						...filter,
						search: '',
						changedOnly: false,
						verification: 'all',
						usage: 'all',
						groups: []
					};
				}}>Show all {noun}</hx-button
			>
		</hx-p>
	{:else if sections.length}
		{#each sections as section (section.id)}
			<hx-section class="ex-group">
				<HarnessGroup
					title={section.title}
					count={section.rows.length}
					source={section.source}
					{resetKey}
				>
					{@render list(section.rows)}
				</HarnessGroup>
			</hx-section>
		{/each}
	{:else}
		{@render list(listed)}
	{/if}
</hx-section>

<style>
	.ex-group {
		margin-top: var(--hx-space-28);
	}
</style>
