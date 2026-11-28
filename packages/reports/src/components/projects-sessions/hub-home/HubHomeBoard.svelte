<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ycw5bbrd23 -->
<script lang="ts">
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { HomeChatReceipt } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import type { HomeBoardColumn } from '$reports/lib/projects-sessions/hub-home/homeBoard.types';
	import { boardView } from './hubHomeBoardView';
	import HubHomeBoardStrip from './HubHomeBoardStrip.svelte';
	import HubHomeBoardCard from './HubHomeBoardCard.svelte';
	import HubHomeBoardDetail from './HubHomeBoardDetail.svelte';
	import HubHomeCosChat from './HubHomeCosChat.svelte';
	import { homeCosChat } from './hubHomeChatContext.svelte';
	import type { HomeView, OpenHomeSection, SendHomeChat } from './hubHomeView.types';

	const firstShown = 5;
	const moreShown = 20;

	let {
		view,
		open,
		send,
		receipt
	}: {
		view: HomeView;
		open: OpenHomeSection;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
	} = $props();
	const chat = homeCosChat();
	const live = $derived(view.computers?.snapshot?.liveOverview);
	let project = $state('');
	let search = $state('');
	let column = $state<HomeBoardColumn>('progress');
	let limits = $state<Partial<Record<HomeBoardColumn, number>>>({});
	let opened = $state<string>();
	let opener: HTMLElement | null = null;
	const board = $derived(boardView(live, view.openAsks, { project, search }));
	const needing = $derived(
		board.columns.find((entry) => entry.id === 'blocked')!.cards.filter((card) => card.ask).length
	);
	const detail = $derived(
		opened ? board.columns.flatMap((entry) => entry.cards).find((c) => c.row.key === opened) : null
	);
	/** A filtered-to project that has no work left shows everything again. */
	const gone = new SvelteSet<string>();
	$effect(() => {
		if (project && !board.projects.some((entry) => entry.name === project)) {
			gone.add(project);
			project = '';
		}
	});

	function show(key: string, trigger: HTMLElement) {
		opener = trigger;
		opened = key;
	}
	function close() {
		const target = opener;
		opened = undefined;
		opener = null;
		void tick().then(() => target?.focus());
	}
	async function showColumn(id: HomeBoardColumn) {
		column = id;
		await tick();
		document.getElementById(`hb-column-${id}`)?.scrollIntoView({ block: 'nearest' });
	}
</script>

<hx-div class="hb-board" data-harness-component="hub-board">
	<hx-h1 class="hh-sr" id="hh-title">Home board</hx-h1>
	<HubHomeBoardStrip {view} {live} {open} {showColumn} />
	<hx-div class="hb-toolbar">
		<hx-div class="hb-chips" role="group" aria-label="Filter by project">
			<hx-button
				type="button"
				class="hb-chip"
				aria-pressed={!project}
				onclick={() => (project = '')}
				>All projects <hx-span class="hb-count">{board.open}</hx-span></hx-button
			>
			{#each board.projects as entry (entry.name)}
				<hx-button
					type="button"
					class="hb-chip"
					aria-pressed={project === entry.name}
					onclick={() => (project = entry.name)}
					>{entry.name} <hx-span class="hb-count">{entry.total}</hx-span></hx-button
				>
			{/each}
		</hx-div>
		<hx-div class="hb-tools">
			<hx-input
				type="search"
				class="hb-search"
				placeholder="Search tasks"
				aria-label="Search tasks"
				bind:value={search}
			/>
			<hx-button
				type="button"
				class="po-action hh-primary hb-new"
				aria-haspopup="dialog"
				onclick={(event) => chat?.open(event.currentTarget)}>New task</hx-button
			>
		</hx-div>
	</hx-div>
	<hx-div class="hb-switch" role="group" aria-label="Show one column">
		{#each board.columns as entry (entry.id)}
			<hx-button
				type="button"
				class="hb-segment"
				aria-pressed={column === entry.id}
				onclick={() => (column = entry.id)}
			>
				<hx-strong
					>{entry.total}{#if entry.id === 'blocked' && needing}<hx-span
							class="hb-diamond"
							aria-label={`, ${needing} need you`}>◆</hx-span
						>{/if}</hx-strong
				>
				<hx-span>{entry.label}</hx-span>
			</hx-button>
		{/each}
	</hx-div>
	{#if !live}<hx-p class="hb-notice" role="status"
			>{view.computers === null || view.computers === undefined
				? 'Asking your linked Mac for its tasks…'
				: 'No linked Mac answered, so only questions for you are listed. Open Harness on your Mac.'}</hx-p
		>{:else if board.partial}<hx-p class="hb-notice" role="status"
			>This Mac sends only tasks in motion: Done covers the last day{board.unlistedOpen
				? `, and ${board.unlistedOpen} more open tasks are not listed`
				: ''}. Update Harness on your Mac to see the whole board.</hx-p
		>{/if}
	<hx-div class="hb-columns">
		{#each board.columns as entry (entry.id)}
			{@const limit = limits[entry.id] ?? firstShown}
			{@const rest = entry.cards.length - Math.min(limit, entry.cards.length)}
			<hx-section
				class="hb-column"
				id={`hb-column-${entry.id}`}
				data-column={entry.id}
				data-selected={column === entry.id}
				aria-label={entry.label}
			>
				<hx-div class="hb-column-head">
					<hx-span class="hb-mark" aria-hidden="true"></hx-span>
					<hx-h2 id={entry.id === 'blocked' ? 'hh-needs-title' : undefined}>{entry.label}</hx-h2>
					<hx-span class="hb-count"
						>{entry.total}{entry.id === 'done'
							? board.partial
								? ' in the last day'
								: ' this week'
							: ''}</hx-span
					>
					{#if entry.id === 'blocked' && needing}<hx-span class="hb-needing"
							>◆ {needing} {needing === 1 ? 'needs' : 'need'} you</hx-span
						>{/if}
				</hx-div>
				{#if entry.cards.length}
					<hx-ul class="hb-cards">
						{#each entry.cards.slice(0, limit) as card (card.row.key)}
							<HubHomeBoardCard {card} now={view.now} {show} />
						{/each}
					</hx-ul>
				{:else}<hx-p class="hb-empty">{search ? 'No matching tasks' : 'Nothing here'}</hx-p>{/if}
				{#if rest > 0}<hx-button
						type="button"
						class="hb-more"
						onclick={() => (limits[entry.id] = limit + moreShown)}
						>Show {Math.min(rest, moreShown)} more</hx-button
					>{:else if entry.total > entry.cards.length}<hx-p class="hb-empty"
						>{entry.total - entry.cards.length} older tasks are not listed</hx-p
					>{/if}
			</hx-section>
		{/each}
	</hx-div>
	{#if view.agents && (view.owner || view.linkedComputers)}<HubHomeCosChat
			agent={view.agents.find((agent) => agent.id === 'cos')}
			now={new Date(view.now).toISOString()}
			asks={view.openAsks}
			{send}
			{receipt}
		/>{/if}
	{#if detail}<HubHomeBoardDetail card={detail} now={view.now} {send} {receipt} {close} />{/if}
</hx-div>
