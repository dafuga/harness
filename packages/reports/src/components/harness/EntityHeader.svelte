<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity, ExplorerLocation } from '../../models/Explorer.types';
	import { entityLabels, entityLens, type EntityNav } from '../../utils/entityLens';
	import { categoryIcon } from '../../utils/harnessIcons';
	import EntityLink from './EntityLink.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessTabs from './HarnessTabs.svelte';
	import HarnessVerdict from './HarnessVerdict.svelte';
	let {
		entity,
		nav,
		shared = false,
		preview
	}: {
		entity: ExplorerEntity;
		nav: EntityNav;
		shared?: boolean;
		/** What stays between the identity and the tabs on every tab: the screenshots of a component. */
		preview?: Snippet;
	} = $props();
	type Place = Pick<ExplorerLocation, 'section' | 'tab'>;
	let label = $derived(entityLabels[entity.category]);
	let visual = $derived(['pages', 'components', 'shells'].includes(entity.category));
	const at = (place: Place = {}) =>
		entityLens(nav.route, { category: entity.category, entity: entity.id, ...place });
	const row: Record<string, Place> = {
		overview: {},
		contract: { tab: 'contract' },
		'used-in': { tab: 'used-in' },
		uses: { tab: 'uses' },
		tests: { tab: 'tests' },
		states: { tab: 'states' },
		history: { section: 'history' },
		source: { tab: 'source' }
	};
	const labels = ['Overview', 'Contract', 'Used In', 'Uses', 'Tests', 'History', 'Source'];
	let tabs = $derived(
		labels.map((label) => {
			const title = visual && label === 'Tests' ? 'States' : label;
			const id = title.toLowerCase().replace(' ', '-');
			return { id, label: title, href: nav.href(at(row[id])) };
		})
	);
	// A tab the row does not have, as the former one of both lists, is shown on the first.
	let asked = $derived(
		tabs.find((tab) => tab.id === (visual && nav.route.tab === 'tests' ? 'states' : nav.route.tab))
			?.id ?? tabs[0].id
	);
	let active = $derived(nav.route.section === 'history' ? 'history' : asked);
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
		{#if nav.route.section === 'history'}
			<li><EntityLink to={at()} {nav}>{entity.name}</EntityLink></li>
			<li aria-current="page">History</li>
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
		<p class="ex-lead">{entity.purpose}</p>
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
	</div>
</header>
{@render preview?.()}
<HarnessTabs
	label={`${entity.name} sections`}
	view={active}
	onview={(id) => nav.go(at(row[id]))}
	{tabs}
/>
