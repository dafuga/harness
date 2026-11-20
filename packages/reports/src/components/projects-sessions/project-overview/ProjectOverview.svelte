<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import { tick } from 'svelte';
	import EmptyState from '../../explorer-ui/explorer-kit/EmptyState.svelte';
	import Notice from '../../explorer-ui/explorer-kit/Notice.svelte';
	import Pill from '../../explorer-ui/explorer-kit/Pill.svelte';
	import DetailList from '../../shared-primitives/DetailList.svelte';
	import Modal from '../../shared-primitives/Modal.svelte';
	import ProjectOverviewCard from './ProjectOverviewCard.svelte';
	import {
		bandsFor,
		etaFor,
		filterChips,
		formatWhen,
		headline,
		projectOf,
		statusLabel,
		stateLabel,
		surfacedContext,
		totalsLine,
		visibleCards
	} from './projectOverviewPresentation';
	import type { OverviewFilter } from './projectOverviewPresentation.types';
	import type { OverviewItem } from '../../../lib/projects-sessions/project-overview/projectOverview.types';
	import type { ProjectOverviewDetailRow, ProjectOverviewProps } from './ProjectOverview.types';
	import './projectOverview.css';
	let { snapshot, homeHref = '/harness' }: ProjectOverviewProps = $props();
	const ready = $derived(snapshot !== null && snapshot.status === 'ready' ? snapshot : null);
	const cards = $derived(ready?.projects ?? []);
	const chips = $derived(filterChips(cards));
	let filter = $state<OverviewFilter>('all');
	const visible = $derived(visibleCards(cards, filter));
	const now = Date.now();
	let selected = $state<OverviewItem | null>(null);
	let opener: HTMLElement | null = null;
	const detailRows = $derived.by((): ProjectOverviewDetailRow[] => {
		if (!selected) return [];
		const item = selected;
		const context = surfacedContext(cards, item);
		const rows: ProjectOverviewDetailRow[] = [
			{ term: 'Project', value: projectOf(cards, item) ?? 'Not listed' },
			{ term: 'Status', value: statusLabel(item.status) },
			{ term: 'ETA', value: etaFor(item.due, now).text },
			{ term: 'Live', value: item.live ? 'Yes' : 'No' },
			{ term: 'Stale', value: item.stale ? 'Yes' : 'No' },
			{ term: 'Updated', value: formatWhen(item.updatedAt) },
			{ term: 'Id', value: item.id }
		];
		if (context) rows.push({ term: 'Context', value: context });
		return rows;
	});
	function openItem(item: OverviewItem): void {
		opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		selected = item;
	}
	function closeItem(): void {
		const target = opener;
		selected = null;
		opener = null;
		void tick().then(() => target?.focus());
	}
</script>

<hx-main class="po-page" data-harness-component="project-overview" aria-labelledby="po-title">
	<hx-header class="po-head">
		<hx-a class="po-home" href={homeHref} aria-label="Back to Harness">Harness</hx-a>
		<hx-p class="po-kicker">Projects</hx-p>
		{#if ready}
			<hx-h1 id="po-title" class="po-title">{headline(cards)}</hx-h1>
			<hx-p class="po-totals">{totalsLine(cards.length, ready.liveSessions)}</hx-p>
			<hx-ul class="po-machines" aria-label="Computers">
				{#each ready.machines as machine (machine.name)}
					<Pill as="li" tone="po-machine" state={machine.status}>
						<hx-span class="po-machine-mark" aria-hidden="true"></hx-span>
						{machine.name} <hx-span class="po-machine-status">{machine.status}</hx-span>
					</Pill>
				{/each}
			</hx-ul>
		{:else}
			<hx-h1 id="po-title" class="po-title">Projects</hx-h1>
		{/if}
	</hx-header>

	{#if snapshot === null}
		<EmptyState as="div" className="po-empty" role="status">Loading projects…</EmptyState>
	{:else if snapshot.status === 'unavailable'}
		<Notice as="div" className="po-notice" role="alert"
			>The tracker could not be reached from this host, so no projects are shown.</Notice
		>
	{:else if cards.length === 0}
		<EmptyState as="div" className="po-empty" role="status"
			>No projects are in the tracker yet.</EmptyState
		>
	{:else}
		<hx-div class="po-filters" role="group" aria-label="Filter projects by state">
			{#each chips as chip (chip.value)}
				<hx-button
					type="button"
					class="po-chip"
					aria-pressed={filter === chip.value}
					onclick={() => (filter = chip.value)}
					>{chip.label} <hx-span class="po-chip-count">{chip.count}</hx-span></hx-button
				>
			{/each}
		</hx-div>
		{#if visible.length === 0}
			<EmptyState as="div" className="po-empty" role="status"
				>No projects are in the {filter === 'all' ? 'All' : stateLabel(filter)} state.</EmptyState
			>
		{:else}
			{#each bandsFor(visible) as band (band.id)}
				<hx-section class="po-band" aria-labelledby={`po-band-${band.id}`}>
					<hx-h2 id={`po-band-${band.id}`} class="po-band-title"
						>{band.label} <hx-span class="po-band-count">{band.cards.length}</hx-span></hx-h2
					>
					<hx-div
						class="po-grid"
						class:po-grid-compact={band.id === 'quiet' || band.id === 'done'}
					>
						{#each band.cards as card (card.agent)}
							<ProjectOverviewCard {card} {now} onOpen={openItem} />
						{/each}
					</hx-div>
				</hx-section>
			{/each}
		{/if}
	{/if}
</hx-main>

<Modal isOpen={selected !== null} title={selected?.title ?? ''} variant="text" onClose={closeItem}>
	{#if selected}
		<DetailList rows={detailRows} rowKey={(row) => row.term} className="po-detail">
			{#snippet label(row)}{row.term}{/snippet}
			{#snippet children(row)}{row.value}{/snippet}
		</DetailList>
	{/if}
</Modal>
