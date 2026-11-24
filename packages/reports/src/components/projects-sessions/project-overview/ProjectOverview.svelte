<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_n72w2an74r -->
<!-- @harness-view overview -->
<script lang="ts">
	import { tick } from 'svelte';
	import BrandMark from '../../shared-primitives/BrandMark.svelte';
	import EmptyState from '../../explorer-ui/explorer-kit/EmptyState.svelte';
	import Notice from '../../explorer-ui/explorer-kit/Notice.svelte';
	import Pill from '../../explorer-ui/explorer-kit/Pill.svelte';
	import DetailList from '../../shared-primitives/DetailList.svelte';
	import Modal from '../../shared-primitives/Modal.svelte';
	import ProjectOverviewCard from './ProjectOverviewCard.svelte';
	import {
		bandsFor,
		filterChips,
		formatWhen,
		headline,
		overviewSelection,
		overviewDetailRows,
		stateLabel,
		totalsLine,
		visibleCards
	} from './projectOverviewPresentation';
	import type { OverviewFilter } from './projectOverviewPresentation.types';
	import type { OverviewItem } from '../../../lib/projects-sessions/project-overview/projectOverview.types';
	import type {
		ProjectOverviewDetailRow,
		ProjectOverviewProps,
		ProjectOverviewSelection
	} from './ProjectOverview.types';
	import '../../../lib/styles/project-overview.css';
	import '../../../lib/styles/project-overview-cards.css';
	import '../../../lib/styles/project-overview-controls.css';
	import '../../../lib/styles/project-overview-responsive.css';
	let { snapshot, homeHref = '/harness', standalone = true }: ProjectOverviewProps = $props();
	const ready = $derived(snapshot !== null && snapshot.status === 'ready' ? snapshot : null);
	const cards = $derived(ready?.projects ?? []);
	const chips = $derived(filterChips(cards));
	let filter = $state<OverviewFilter>('all');
	const visible = $derived(visibleCards(cards, filter));
	const now = Date.now();
	let selection = $state<ProjectOverviewSelection | null>(null);
	const selected = $derived(overviewSelection(cards, selection));
	$effect(() => {
		if (selection && !selected) closeItem();
	});
	let opener: HTMLElement | null = null;
	const detailRows = $derived(overviewDetailRows(selected, now));
	function openItem(item: OverviewItem, kind: 'item' | 'decision' = 'item'): void {
		opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		selection = { kind, itemId: item.id };
	}
	function closeItem(): void {
		const target = opener;
		selection = null;
		opener = null;
		void tick().then(() => target?.focus());
	}
</script>

{#snippet page()}
	<hx-header class="po-head">
		{#if standalone}
			<hx-a class="po-home" href={homeHref} aria-label="Back to Harness"
				><BrandMark size={24} />Harness</hx-a
			>
		{/if}
		<hx-p class="po-kicker">Projects</hx-p>
		{#if ready}
			<hx-h1 id="po-title" class="po-title">{headline(cards)}</hx-h1>
			<hx-p class="po-totals">{totalsLine(cards.length, ready.liveSessions)}</hx-p>
			<hx-ul class="po-machines" aria-label="Computers">
				{#each ready.machines as machine (machine)}
					<Pill as="li" tone="po-machine" state={machine.status}>
						<hx-span class="po-machine-mark" aria-hidden="true"></hx-span>
						{machine.name} <hx-span class="po-machine-status">{machine.status}</hx-span>
						<hx-span
							>{machine.queued == null ? 'Queue unavailable' : `Queued ${machine.queued}`}</hx-span
						>
						<hx-span
							>{machine.lastTickAt
								? `Checked ${formatWhen(machine.lastTickAt)}`
								: 'Check time unavailable'}</hx-span
						>
					</Pill>
				{/each}
			</hx-ul>
			{#if !ready.machines.length}
				<hx-p class="po-totals">Computer status unavailable</hx-p>
			{/if}
			<hx-ul class="po-machines" aria-label="Provider budget">
				{#each ['claude', 'codex'] as provider (provider)}
					{@const budget = ready.providerBudgets?.find((reading) => reading.provider === provider)}
					<Pill as="li" tone="po-machine">
						{provider === 'claude' ? 'Claude' : 'Codex'}
						{#if budget}
							{#each budget.limits as limit (limit)}
								<hx-span
									>{limit.label}
									{limit.left}% left{limit.resetsAt
										? ` · resets ${formatWhen(limit.resetsAt)}`
										: ''}</hx-span
								>
							{/each}
							<hx-span>Checked {formatWhen(budget.readAt)}</hx-span>
						{:else}
							<hx-span>Budget unavailable</hx-span>
						{/if}
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
			>{snapshot.reason === 'stale'
				? 'The last Project Overview update expired. Waiting for a fresh update from the host.'
				: snapshot.reason === 'host-revoked'
					? 'The publishing host no longer has access to Project Overview.'
					: 'The tracker could not be reached from this host, so no projects are shown.'}</Notice
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
					<hx-div class="po-grid" class:po-grid-compact={band.id === 'quiet' || band.id === 'done'}>
						{#each band.cards as card (card)}
							<ProjectOverviewCard
								{card}
								{now}
								onOpen={openItem}
								onDecision={(item) => openItem(item, 'decision')}
							/>
						{/each}
					</hx-div>
				</hx-section>
			{/each}
		{/if}
	{/if}
{/snippet}

<!-- Standalone (the native renderer) is the whole document: its own main and Harness link. Inside
	the website's explorer layout, the layout already provides the main and the Harness brand. -->
{#if standalone}
	<hx-main
		class="po-page"
		data-harness-component="projects-sessions-project-overview-project-overview"
		aria-labelledby="po-title"
	>
		{@render page()}
	</hx-main>
{:else}
	<hx-div
		class="po-page"
		data-harness-component="projects-sessions-project-overview-project-overview"
	>
		{@render page()}
	</hx-div>
{/if}

<Modal isOpen={selected !== null} title={selected?.title ?? ''} variant="text" onClose={closeItem}>
	{#if selected}
		<DetailList rows={detailRows} rowKey={(row) => row.term} className="po-detail">
			{#snippet label(row: ProjectOverviewDetailRow)}{row.term}{/snippet}
			{#snippet children(row: ProjectOverviewDetailRow)}{row.value}{/snippet}
		</DetailList>
		{#if selection?.kind === 'item'}
			{#each selected.item.runs ?? [] as run (run)}
				<hx-button
					type="button"
					class="po-action"
					onclick={() => {
						if (selected) selection = { kind: 'run', itemId: selected.item.id, run };
					}}
				>
					Open run #{run.id}
				</hx-button>
			{/each}
		{/if}
	{/if}
</Modal>
