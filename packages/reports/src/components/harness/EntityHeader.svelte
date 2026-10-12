<script lang="ts">
	import type { ExplorerEntity, ExplorerLocation } from '../../models/Explorer.types';
	import { entityLabels, entityLens, type EntityNav } from '../../utils/entityLens';
	import { categoryIcon } from '../../utils/harnessIcons';
	import EntityLink from './EntityLink.svelte';
	import HarnessAction from './HarnessAction.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessTabs from './HarnessTabs.svelte';
	import HarnessVerdict from './HarnessVerdict.svelte';
	let {
		entity,
		nav,
		shared = false
	}: { entity: ExplorerEntity; nav: EntityNav; shared?: boolean } = $props();
	type Place = Pick<ExplorerLocation, 'section' | 'tab'>;
	let label = $derived(entityLabels[entity.category]);
	let details = $derived(nav.route.section === 'details');
	const at = (place: Place = {}) =>
		entityLens(nav.route, { category: entity.category, entity: entity.id, ...place });
	// History is a screen of its own, reached from either row of tabs.
	const places: Record<string, Place> = {
		overview: {},
		relationships: { tab: 'relationships' },
		tests: { tab: 'tests' },
		contract: { section: 'details' },
		measurements: { section: 'details', tab: 'measurements' },
		source: { section: 'details', tab: 'source' },
		history: { section: 'history' }
	};
	const rows = {
		overview: ['Overview', 'Relationships', 'Tests', 'History'],
		details: ['Contract', 'Measurements', 'Source', 'History']
	};
	let tabs = $derived(
		rows[details ? 'details' : 'overview'].map((title) => {
			const id = title.toLowerCase();
			return { id, label: title, href: nav.href(at(places[id])) };
		})
	);
	let active = $derived(
		nav.route.section === 'history' ? 'history' : (nav.route.tab ?? tabs[0].id)
	);
	// A route with a parameter is a pattern, not an address a person can open.
	let openable = $derived(Boolean(entity.appRoute) && !/[[\]:*]/.test(entity.appRoute ?? ''));
</script>

<nav class="ex-crumbs" aria-label="Breadcrumb">
	<ol>
		<li>
			<EntityLink to={entityLens(nav.route, { category: entity.category })} {nav}
				>{label.title}</EntityLink
			>
		</li>
		{#if nav.route.section}
			<li><EntityLink to={at()} {nav}>{entity.name}</EntityLink></li>
			<li aria-current="page">{details ? 'Details' : 'History'}</li>
		{:else}
			<li aria-current="page">{entity.name}</li>
		{/if}
	</ol>
</nav>
<header class="ex-head">
	<span class="ex-tile"><HarnessIcon name={categoryIcon[entity.category]} size={30} /></span>
	<div class="ex-head-main">
		<div class="ex-head-title">
			<h1>{entity.name}</h1>
			<span class="ex-pill">{entity.role}</span>
			{#if shared}<span class="ex-pill gold">Shared</span>{/if}
			{#if entity.change === 'removed'}<span class="ex-pill">Removed at this commit</span>{/if}
			<HarnessVerdict {...entity.verdict} />
		</div>
		<p class="ex-lead">{details ? 'Contract and measurements' : entity.purpose}</p>
	</div>
	<div class="ex-head-actions">
		{#if entity.category === 'pages'}
			<p class="ex-route">
				<HarnessIcon name="route" size={18} />
				<span>App route</span>
				{#if openable}
					<a href={entity.appRoute} target="_blank" rel="noreferrer"
						><code>{entity.appRoute}</code><HarnessIcon name="external" size={16} /></a
					>
				{:else}
					<code>{entity.appRoute ?? 'Not recorded'}</code>
				{/if}
			</p>
		{/if}
		{#if details}
			<HarnessAction href={nav.href(at())} onclick={() => nav.go(at())} lead="arrow-left"
				>Back to overview</HarnessAction
			>
		{:else}
			<HarnessAction
				href={nav.href(at(places.contract))}
				onclick={() => nav.go(at(places.contract))}
				icon="arrow-right">Details</HarnessAction
			>
		{/if}
	</div>
</header>
<HarnessTabs
	label={`${entity.name} sections`}
	view={active}
	onview={(id) => nav.go(at(places[id]))}
	{tabs}
/>
