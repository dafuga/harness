<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Card } from './ExplorerPlatforms.types';

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
	import EntityLink from './EntityLink.svelte';
	import ExplorerControls from './ExplorerControls.svelte';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import ExplorerPlatformDetails from './ExplorerPlatformDetails.svelte';
	import {
		platformStatus,
		platformViews,
		unrecorded
	} from '../../utils/explorer-ui/explorer-platforms/platformStatus';
	let host: ExplorerScreenProps = $props();
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
	<hx-label class="filter-field"
		><hx-span>Status</hx-span>
		<Select label="Status filter" bind:value={status}>
			{#each statuses as [id, text] (id)}<hx-option value={id}>{text}</hx-option>{/each}
		</Select>
	</hx-label>
{/snippet}

<!-- The whole card opens its platform; the one link in it is the platform's name. -->
{#snippet platformCard(card: Card, nav: EntityNav)}
	<hx-article class="pf-card">
		<hx-header class="pf-card-head">
			<hx-span class="ex-tile small"><HarnessIcon name={card.icon} size={22} /></hx-span>
			<hx-h2>
				<EntityLink to={at(card.id)} {nav} class="pf-open" label={`View ${card.name} configuration`}
					>{card.name}</EntityLink
				>
			</hx-h2>
			<hx-span class="pf-chevron"><HarnessIcon name="chevron-right" size={18} /></hx-span>
		</hx-header>
		<hx-p class="pf-summary">
			{card.entry?.summary ?? `Nothing is declared for ${card.name} at this revision.`}
		</hx-p>
		<hx-dl class="pf-facts">
			<hx-div>
				<hx-dt>Status</hx-dt>
				<hx-dd
					><hx-span class="pf-status" data-status={card.status.id}>{card.status.label}</hx-span
					></hx-dd
				>
			</hx-div>
			<hx-div>
				<hx-dt>Runtime</hx-dt>
				<hx-dd>{card.entry?.runtime ?? 'Not recorded'}</hx-dd>
			</hx-div>
		</hx-dl>
		{#if card.tally}<hx-p class="pf-tally">{card.tally}</hx-p>{/if}
	</hx-article>
{/snippet}

<!-- The platforms are settings of the selected revision, read whether or not it has a registry. -->
<ExplorerFrame {host} registryRequired={false}>
	{#snippet children(nav)}
		{#if host.route.entity}
			<ExplorerPlatformDetails {host} {nav} />
		{:else}
			<hx-section class="ex-index" aria-labelledby="pf-title">
				<hx-nav class="ex-crumbs" aria-label="Breadcrumb">
					<hx-ol>
						<hx-li><HarnessIcon name={categoryIcon.platforms} size={18} /></hx-li>
						<hx-li aria-current="page">{label.title}</hx-li>
					</hx-ol>
				</hx-nav>
				<hx-h1 id="pf-title">{label.title}</hx-h1>
				<hx-p class="ex-lead">{label.subtitle}</hx-p>
				<hx-p class="ex-soft">
					Each status is what the repository declares at this revision, not a check of a live
					deployment.
				</hx-p>
				{#if gap}
					<hx-p class="pf-notice"
						><HarnessIcon name="info" size={18} /><hx-span>{gap}</hx-span></hx-p
					>
				{/if}
				<hx-div class="pf-controls">
					<ExplorerControls noun="platforms" bind:filter />
					<FilterDialog active={Number(status !== 'all')} onreset={() => (status = 'all')}>
						{@render statusFilter()}
					</FilterDialog>
				</hx-div>
				<hx-p class="ex-hidden" role="status"
					>{listed.length} of {cards.length} platforms shown</hx-p
				>
				{#if listed.length}
					<hx-div class="pf-grid">
						{#each listed as card (card.id)}{@render platformCard(card, nav)}{/each}
					</hx-div>
				{:else}
					<hx-p class="ex-empty">
						No platforms match this search or filter.
						<hx-button type="button" class="ex-text-button" onclick={showAll}
							>Show all platforms</hx-button
						>
					</hx-p>
				{/if}
			</hx-section>
		{/if}
	{/snippet}
</ExplorerFrame>
