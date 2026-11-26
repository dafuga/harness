<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_62ump5nnwq -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		InboxFilter,
		InboxOverview,
		InboxRow,
		InboxWriteView,
		TrackerInboxSource
	} from '../../../models/development-tooling/TrackerInbox.types';
	import {
		bucketLabels,
		countBuckets,
		filterRows,
		inboxFilters,
		writeView
	} from '../../../lib/development-tooling/tracker-inbox/trackerInbox';
	import TrackerInboxDetail from './TrackerInboxDetail.svelte';
	import TrackerInboxRows from './TrackerInboxRows.svelte';
	import TrackerInboxWrites from './TrackerInboxWrites.svelte';

	let { source, mode = 'phone' }: { source: TrackerInboxSource; mode?: 'phone' | 'mac' } = $props();
	const mac = $derived(mode === 'mac');

	let overview = $state.raw<InboxOverview | null>(null);
	let loadFailure = $state('');
	let filter = $state<InboxFilter>('needs-you');
	let query = $state('');
	let found = $state.raw<InboxRow[] | null>(null);
	let selected = $state<string | null>(null);
	let writes = $state.raw<InboxWriteView[]>([]);
	let freshness = $state<'current' | 'stale' | 'unavailable'>('unavailable');
	let lastSyncedAt = $state<string | null>(null);

	const counts = $derived(countBuckets(overview?.rows ?? []));
	const listed = $derived(filterRows(overview?.rows ?? [], filter));

	function note(reply: { freshness: typeof freshness; lastSyncedAt: string | null }) {
		freshness = reply.freshness;
		lastSyncedAt = reply.lastSyncedAt;
	}

	/** Reloads the decision list and the write states. Called after every confirmed write. */
	export async function reload(): Promise<void> {
		const [status, outbox] = await Promise.all([source.overview(), source.writes()]);
		note(status);
		overview = status.value ?? null;
		loadFailure = status.value
			? ''
			: mac
				? 'Tracker could not be reached on this Mac.'
				: status.code === 'denied' || status.code === 'noReplica'
					? 'No Tracker copy is on this phone yet. Connect to your computer to sync it.'
					: 'The Tracker copy on this phone could not be read.';
		writes = (outbox.value ?? []).map(writeView);
	}

	async function search(term: string) {
		if (term.trim() === '') {
			found = null;
			return;
		}
		const reply = await source.search(term.trim());
		note(reply);
		found = reply.value ?? [];
	}

	function choose(id: string) {
		selected = id;
	}

	onMount(() => void reload());
</script>

<hx-section class="inbox" aria-label="Tracker decisions">
	<hx-header class="inbox-head">
		<hx-h1>Needs you</hx-h1>
		<hx-p class="meta">
			{#if mac}
				{overview ? 'Local Tracker' : 'Tracker on this Mac'}
			{:else if freshness === 'current'}
				Synced {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'just now'}
			{:else if freshness === 'stale'}
				Showing the last copy. It may be out of date.
			{:else}
				No live copy. Writes wait until the phone reconnects.
			{/if}
		</hx-p>
	</hx-header>

	{#if loadFailure}
		<hx-p class="meta" role="status">{loadFailure}</hx-p>
	{:else if overview && selected}
		<hx-button type="button" class="back" onclick={() => (selected = null)}>← All items</hx-button>
		{#key selected}
			<TrackerInboxDetail {source} {mode} id={selected} onchanged={reload} />
		{/key}
		{#if !mac}<TrackerInboxWrites {source} {writes} onchanged={reload} />{/if}
	{:else if overview}
		<hx-nav class="filters" aria-label="Filter items">
			{#each inboxFilters as name (name)}
				<hx-button
					type="button"
					class="filter"
					aria-pressed={filter === name}
					data-bucket={name}
					onclick={() => (filter = name)}
				>
					{name === 'all' ? 'All' : bucketLabels[name]}
					<hx-span class="count">{counts[name]}</hx-span>
				</hx-button>
			{/each}
		</hx-nav>

		<hx-form
			class="search"
			onsubmit={(event: SubmitEvent) => {
				event.preventDefault();
				void search(query);
			}}
		>
			<hx-input-search
				aria-label="Search items by ID or title"
				placeholder="Search by ID or title"
				maxlength="160"
				value={query}
				oninput={(event: Event) => (query = (event.currentTarget as HTMLInputElement).value)}
			/>
		</hx-form>

		{#if found}
			<hx-h2>Search results</hx-h2>
			<TrackerInboxRows
				rows={found}
				{selected}
				label="Search results"
				empty={mac
					? 'No Tracker items match that search.'
					: 'Nothing on this phone matches that search.'}
				onselect={choose}
			/>
		{:else}
			{#if filter === 'needs-you' && listed.length}<hx-h2 class="needs-title"
					>Blocked - needs you</hx-h2
				>{/if}
			<TrackerInboxRows
				rows={listed}
				{selected}
				label={filter === 'all' ? 'All items' : bucketLabels[filter]}
				empty="Nothing here right now."
				onselect={choose}
			/>
			{#if overview.needsYouCapped && filter === 'needs-you'}
				<hx-p class="meta"
					>Only the most recent Needs you items are on this phone. Search for others.</hx-p
				>
			{/if}
		{/if}

		{#if !mac}<TrackerInboxWrites {source} {writes} onchanged={reload} />{/if}
	{:else}
		<hx-p class="meta" role="status"
			>{mac ? 'Loading Tracker items.' : 'Loading the Tracker copy on this phone.'}</hx-p
		>
	{/if}
</hx-section>

<style>
	:global(.inbox) {
		display: grid;
		gap: var(--hx-space-12);
		padding: var(--hx-space-16);
		color: var(--hx-color-text);
	}
	:global(.inbox h1) {
		margin: 0;
		font-size: var(--hx-type-size-base);
	}
	:global(.inbox .meta) {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
		margin: 0;
	}
	:global(.inbox .needs-title) {
		margin: 0;
		font-size: var(--hx-type-size-sm);
	}
	:global(.inbox button.back) {
		justify-self: start;
		border: var(--hx-border-thin) solid var(--hx-color-border);
		background: var(--hx-color-surface);
		color: var(--hx-color-text);
		border-radius: var(--hx-radius-small);
		padding: var(--hx-space-8) var(--hx-space-10);
		font: inherit;
	}
	:global(.filters) {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hx-space-6);
	}
	:global(.inbox button.filter) {
		border: var(--hx-border-thin) solid var(--hx-color-border);
		background: var(--hx-color-surface);
		color: var(--hx-color-text);
		border-radius: var(--hx-radius-small);
		padding: var(--hx-space-8) var(--hx-space-10);
		font: inherit;
	}
	:global(.inbox button.filter[aria-pressed='true']) {
		border-color: var(--hx-color-primary);
	}
	:global(.count) {
		margin-left: var(--hx-space-6);
		color: var(--hx-color-text-muted);
	}
	:global(.inbox input[type='search']) {
		width: 100%;
		box-sizing: border-box;
		padding: var(--hx-space-8);
		font: inherit;
		background: var(--hx-color-surface);
		color: var(--hx-color-text);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-small);
	}
</style>
