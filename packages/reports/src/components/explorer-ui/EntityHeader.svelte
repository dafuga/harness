<script lang="ts">
	import type { Place } from './EntityHeader.types';

	import type { Snippet } from 'svelte';
	import type { ExplorerEntity, ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
	import { explorerCategory } from '../../utils/explorer-ui/explorerCategory';
	import { entityLabels, entityLens, type EntityNav } from '../../utils/explorer-ui/entityLens';
	import { categoryIcon } from '../../utils/explorer-ui/harnessIcons';
	import EntityLink from './EntityLink.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessTabs from './HarnessTabs.svelte';
	import HarnessVerdict from './harness-verdict/HarnessVerdict.svelte';
	let {
		entity,
		owner,
		nav,
		preview,
		usesAvailable = true
	}: {
		entity: ExplorerEntity;
		/** The sole owner of a private function, when the revision records one. */
		owner?: ExplorerEntity;
		nav: EntityNav;
		/** What stays between the identity and the tabs on every tab: the screenshots of a component. */
		preview?: Snippet;
		/** A selected helper exposes Uses only when a helper call is recorded. */
		usesAvailable?: boolean;
	} = $props();
	let label = $derived(entityLabels[entity.category]);
	let privateFunction = $derived(
		entity.category === 'functions' && explorerCategory(entity.unit) === null
	);
	let visual = $derived(['pages', 'components', 'layouts'].includes(entity.category));
	let evidenceTab: 'states' | 'examples' | 'tests' = $derived.by(() => {
		if (visual) return 'states';
		// Functions and services are shown by their authored uses; other kinds by their tests.
		return ['functions', 'services'].includes(entity.category) ? 'examples' : 'tests';
	});
	const evidenceLabels = { states: 'States', examples: 'Examples', tests: 'Tests' };
	const at = (place: Place = {}) =>
		entityLens(nav.route, { category: entity.category, entity: entity.id, ...place });
	const row: Record<string, Place> = {
		overview: {},
		contract: { tab: 'contract' },
		table: { tab: 'table' },
		models: { tab: 'models' },
		'used-in': { tab: 'used-in' },
		uses: { tab: 'uses' },
		audio: { tab: 'audio' },
		tests: { tab: 'tests' },
		examples: { tab: 'examples' },
		states: { tab: 'states' },
		history: { section: 'history' },
		source: { tab: 'source' }
	};
	const labels = [
		'Overview',
		'Contract',
		'Table',
		'Used In',
		'Uses',
		'Audio',
		'Tests',
		'History',
		'Source'
	];
	// A model documents the database table it declares beside its contract.
	let tabs = $derived(
		labels
			.filter(
				(label) =>
					(entity.category !== 'pages' || label !== 'Used In') &&
					(label !== 'Table' || entity.category === 'models') &&
					(label !== 'Audio' || entity.category === 'components') &&
					(label !== 'Uses' || usesAvailable)
			)
			.map((label) => {
				const title =
					label === 'Contract' && entity.category === 'pages'
						? 'Models'
						: label === 'Tests'
							? evidenceLabels[evidenceTab]
							: label;
				const id = title.toLowerCase().replace(' ', '-');
				return { id, label: title, href: nav.href(at(row[id])) };
			})
	);
	// A tab the row does not have, as the former one of both lists, is shown on the first.
	let asked = $derived(
		tabs.find(
			(tab) =>
				tab.id ===
				(nav.route.tab === 'tests'
					? evidenceTab
					: entity.category === 'pages' && nav.route.tab === 'contract'
						? 'models'
						: nav.route.tab)
		)?.id ?? tabs[0].id
	);
	let active = $derived(nav.route.section === 'history' ? 'history' : asked);
	// A page keeps its purpose in Overview and data relationships in Models.
	let concise = $derived(entity.category === 'pages');
</script>

<nav class="ex-crumbs" aria-label="Breadcrumb">
	<ol>
		<li>
			{#if privateFunction}
				{#if owner}
					<EntityLink
						to={entityLens(nav.route, { category: owner.category, entity: owner.id })}
						{nav}>{owner.name}</EntityLink
					>
				{:else}<span>Function</span>{/if}
			{:else}
				<EntityLink to={entityLens(nav.route, { category: entity.category })} {nav}
					>{label.title}</EntityLink
				>
			{/if}
		</li>
		{#if !privateFunction && entity.unit.group}
			<li>{entity.unit.group.title}</li>
		{/if}
		{#if nav.route.section === 'history'}
			<li><EntityLink to={at()} {nav}>{entity.name}</EntityLink></li>
			<li aria-current="page">History</li>
		{:else}
			<li aria-current="page">{entity.name}</li>
		{/if}
	</ol>
</nav>
<header class="ex-head" data-harness-component="harness-entity-header">
	<span class="ex-tile"><HarnessIcon name={categoryIcon[entity.category]} size={30} /></span>
	<div class="ex-head-main">
		<div class="ex-head-title">
			<h1>{entity.name}</h1>
			<span class="ex-pill">{entity.role}</span>
			{#if entity.change === 'removed'}<span class="ex-pill">Removed at this commit</span>{/if}
			<HarnessVerdict {...entity.verdict} />
		</div>
		{#if !concise}<p class="ex-lead">{entity.purpose}</p>{/if}
	</div>
</header>
{@render preview?.()}
<HarnessTabs
	label={`${entity.name} sections`}
	view={active}
	onview={(id) => nav.go(at(row[id]))}
	{tabs}
/>
