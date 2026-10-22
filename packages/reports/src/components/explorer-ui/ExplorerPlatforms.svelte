<script lang="ts">
	import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import type {
		PlatformEntry,
		PlatformId
	} from '../../../../../src/core/explorer-ui/Platform.types';
	import type { CatalogFilter } from '../../utils/explorer-ui/entityCatalog';
	import { entityLabels, type EntityNav } from '../../utils/explorer-ui/entityLens';
	import { categoryIcon } from '../../utils/explorer-ui/harnessIcons';
	import '../../lib/styles/platforms.css';
	import Select from '../shared-primitives/Select.svelte';
	import FilterDialog from '../shared-primitives/FilterDialog.svelte';
	import EntityLink from './harness/EntityLink.svelte';
	import ExplorerControls from './harness/ExplorerControls.svelte';
	import ExplorerFrame from './harness/ExplorerFrame.svelte';
	import HarnessIcon from './harness/HarnessIcon.svelte';
	import ExplorerPlatformDetails from './ExplorerPlatformDetails.svelte';
	import {
		platformStatus,
		platformViews,
		unrecorded
	} from '../../utils/explorer-ui/explorer-platforms/platformStatus';
	let host: ExplorerScreenProps = $props();
	type Card = (typeof platformViews)[number] & {
		entry?: PlatformEntry;
		status: ReturnType<typeof platformStatus>;
		tally: string;
	};
	const label = entityLabels.platforms;
	const statuses = [
		['all', 'All statuses'],
		['configured', 'Configured'],
		['setup-required', 'Setup required'],
		['not-configured', 'Not configured'],
		['not-recorded', 'Not recorded']
	];
	let filter = $state<CatalogFilter>({ search: '', changedOnly: false, order: 'name' });
	let status = $state('all');
	let catalog = $derived(host.head.platforms);
	// Configuration comes only from this revision: a platform it does not declare is unrecorded.
	let cards = $derived<Card[]>(
		platformViews.map((view) => {
			const entry = catalog?.entries.find((item) => item.id === view.id);
			return { ...view, entry, status: platformStatus(entry), tally: entry ? tally(entry) : '' };
		})
	);
	let listed = $derived(cards.filter((card) => matches(card, filter.search.trim().toLowerCase())));
	let gap = $derived(catalog ? catalog.gap : unrecorded);
	function matches(card: Card, query: string): boolean {
		if (status !== 'all' && card.status.id !== status) return false;
		const words = [card.name, card.entry?.runtime ?? '', card.entry?.summary ?? ''];
		return !query || words.some((word) => word.toLowerCase().includes(query));
	}
	const count = (total: number, noun: string) =>
		total ? `${total} ${noun}${total === 1 ? '' : 's'}` : '';
	/** What the detail page of a platform holds, in one line. */
	function tally(entry: PlatformEntry): string {
		return [
			count(entry.configuration.length, 'setting'),
			count(entry.commands.length, 'command'),
			count(entry.requirements.length, 'requirement')
		]
			.filter(Boolean)
			.join(' · ');
	}
	const at = (id: PlatformId): ExplorerLocation => ({
		branch: host.route.branch,
		commit: host.route.commit,
		category: 'platforms',
		entity: id
	});
	function showAll() {
		filter.search = '';
		status = 'all';
	}
</script>

{#snippet statusFilter()}
	<label class="filter-field"
		><span>Status</span>
		<Select label="Status filter" bind:value={status}>
			{#each statuses as [id, text] (id)}<option value={id}>{text}</option>{/each}
		</Select>
	</label>
{/snippet}

<!-- The whole card opens its platform; the one link in it is the platform's name. -->
{#snippet platformCard(card: Card, nav: EntityNav)}
	<article class="pf-card">
		<header class="pf-card-head">
			<span class="ex-tile small"><HarnessIcon name={card.icon} size={22} /></span>
			<h2>
				<EntityLink to={at(card.id)} {nav} class="pf-open" label={`View ${card.name} configuration`}
					>{card.name}</EntityLink
				>
			</h2>
			<span class="pf-chevron"><HarnessIcon name="chevron-right" size={18} /></span>
		</header>
		<p class="pf-summary">
			{card.entry?.summary ?? `Nothing is declared for ${card.name} at this revision.`}
		</p>
		<dl class="pf-facts">
			<div>
				<dt>Status</dt>
				<dd><span class="pf-status" data-status={card.status.id}>{card.status.label}</span></dd>
			</div>
			<div>
				<dt>Runtime</dt>
				<dd>{card.entry?.runtime ?? 'Not recorded'}</dd>
			</div>
		</dl>
		{#if card.tally}<p class="pf-tally">{card.tally}</p>{/if}
	</article>
{/snippet}

<!-- The platforms are settings of the selected revision, read whether or not it has a registry. -->
<ExplorerFrame {host} registryRequired={false}>
	{#snippet children(nav)}
		{#if host.route.entity}
			<ExplorerPlatformDetails {host} {nav} />
		{:else}
			<section class="ex-index" aria-labelledby="pf-title">
				<nav class="ex-crumbs" aria-label="Breadcrumb">
					<ol>
						<li><HarnessIcon name={categoryIcon.platforms} size={18} /></li>
						<li aria-current="page">{label.title}</li>
					</ol>
				</nav>
				<h1 id="pf-title">{label.title}</h1>
				<p class="ex-lead">{label.subtitle}</p>
				<p class="ex-soft">
					Each status is what the repository declares at this revision, not a check of a live
					deployment.
				</p>
				{#if gap}
					<p class="pf-notice"><HarnessIcon name="info" size={18} /><span>{gap}</span></p>
				{/if}
				<div class="pf-controls">
					<ExplorerControls noun="platforms" bind:filter />
					<FilterDialog active={Number(status !== 'all')} onreset={() => (status = 'all')}>
						{@render statusFilter()}
					</FilterDialog>
				</div>
				<p class="ex-hidden" role="status">{listed.length} of {cards.length} platforms shown</p>
				{#if listed.length}
					<div class="pf-grid">
						{#each listed as card (card.id)}{@render platformCard(card, nav)}{/each}
					</div>
				{:else}
					<p class="ex-empty">
						No platforms match this search or filter.
						<button type="button" class="ex-text-button" onclick={showAll}
							>Show all platforms</button
						>
					</p>
				{/if}
			</section>
		{/if}
	{/snippet}
</ExplorerFrame>
