<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_62ump5nnwq -->
<script lang="ts">
	import './trackerInboxChoices.css';
	import { onMount } from 'svelte';
	import type {
		InboxFilter,
		InboxReply,
		InboxOverview,
		InboxRow,
		InboxWriteView,
		TrackerInboxProps,
		TrackerInboxSource
	} from '../../../models/development-tooling/TrackerInbox.types';
	import {
		countBuckets,
		filterLabel,
		filterRows,
		inboxFilters,
		writeView
	} from '../../../lib/development-tooling/tracker-inbox/trackerInbox';
	import { followTrackerSource } from '../../../lib/development-tooling/tracker-inbox/followTrackerSource';
	import {
		overviewFailureMessage,
		syncMessage
	} from '../../../lib/development-tooling/tracker-inbox/trackerInboxMessages';
	import { withRowChoices } from '../../../lib/development-tooling/tracker-inbox/withRowChoices';
	import type { RealtimeState } from '$reports/lib/projects-sessions/realtime/realtime.types';
	import TrackerInboxDetail from './TrackerInboxDetail.svelte';
	import TrackerInboxReminders from './TrackerInboxReminders.svelte';
	import TrackerInboxRows from './TrackerInboxRows.svelte';
	import TrackerInboxWrites from './TrackerInboxWrites.svelte';
	let { source, mode = 'phone', home = false, project }: TrackerInboxProps = $props();
	const mac = $derived(mode === 'mac');
	const tabs = $derived(inboxFilters.filter((name) => !project || name !== 'reminders'));
	let overview = $state.raw<InboxOverview | null>(null);
	let loadFailure = $state('');
	let notice = $state('');
	let filter = $state<InboxFilter>('needs-you');
	let query = $state('');
	let found = $state.raw<InboxRow[] | null>(null);
	let selected = $state<string | null>(null);
	let writes = $state.raw<InboxWriteView[]>([]);
	let sync = $state.raw<Pick<InboxReply<never>, 'freshness' | 'lastSyncedAt'>>();
	let link = $state<RealtimeState | null>(null);
	let detailView = $state<ReturnType<typeof TrackerInboxDetail>>();
	const inProject = (rows: InboxRow[]) =>
		project ? rows.filter(({ header }) => header.project === project) : rows;
	const counts = $derived(countBuckets(overview?.rows ?? [], overview?.reminders.length));
	const listed = $derived(filterRows(overview?.rows ?? [], filter));

	export async function reload(): Promise<void> {
		const [status, outbox] = await Promise.all([
			source.overview(),
			home ? undefined : source.writes()
		]);
		sync = { freshness: status.freshness, lastSyncedAt: status.lastSyncedAt };
		const value = status.value;
		overview = value
			? { ...value, rows: await withRowChoices(source, inProject(value.rows)) }
			: null;
		loadFailure = value ? '' : overviewFailureMessage(status.code, mode);
		writes = (outbox?.value ?? []).map(writeView);
	}

	async function search(term: string) {
		if (term.trim() === '') {
			found = null;
			return;
		}
		const reply = await source.search(term.trim());
		sync = { freshness: reply.freshness, lastSyncedAt: reply.lastSyncedAt };
		found = await withRowChoices(source, inProject(reply.value ?? []));
	}

	function choose(id: string) {
		selected = id;
		notice = '';
	}

	/** A change made anywhere: the list, an open search and the open item are read again. */
	async function follow() {
		await Promise.all([reload(), found ? search(query) : undefined, detailView?.refresh()]);
	}
	const shared = $derived({
		source,
		mode,
		onchanged: follow,
		onnotice: (message: string) => (notice = message),
		onselect: choose
	});
	onMount(() => {
		void reload();
		return followTrackerSource(source, { refresh: follow, state: (state) => (link = state) });
	});
</script>

{#snippet rows(
	items: InboxRow[] = listed,
	label: string = filter === 'all' ? 'All items' : filterLabel(filter),
	empty: string = filter === 'needs-you' ? 'Nothing needs you right now' : 'Nothing here right now.'
)}
	<TrackerInboxRows {...shared} rows={items} {selected} {label} {empty} />
{/snippet}

{#snippet needsHeading()}
	<hx-div class="needs-head">
		<hx-h2 class="needs-title" id="inbox-needs-title">Blocked - needs you</hx-h2>
		{#if overview}<hx-span class="needs-count" class:empty-count={!listed.length}
				>{listed.length
					? `${listed.length} ${listed.length === 1 ? 'needs' : 'need'} you`
					: '0'}</hx-span
			>{/if}
	</hx-div>
{/snippet}

<hx-section
	class="inbox"
	class:home-blockers={home}
	aria-label={home ? 'Blocked - needs you' : 'Tracker decisions'}
>
	{#if home}{@render needsHeading()}{:else}<hx-header class="inbox-head">
			<hx-h1>{filter === 'reminders' ? 'Reminders' : (project ?? 'Needs you')}</hx-h1>
			{#if link}
				<hx-span class="live" role="status" aria-label="Updates" data-state={link}>
					{link === 'live' ? 'Live' : 'Reconnecting'}
				</hx-span>
			{/if}
			<hx-p class="meta">{syncMessage(mode, Boolean(overview), sync)}</hx-p>
		</hx-header>{/if}

	{#if notice}<hx-p class="meta" role="status">{notice}</hx-p>{/if}

	{#if loadFailure}
		<hx-p class="meta" role="status">{loadFailure}</hx-p>
	{:else if overview && selected}
		<hx-button type="button" class="back" onclick={() => (selected = null)}>← All items</hx-button>
		{#key selected}
			<TrackerInboxDetail bind:this={detailView} {source} {mode} id={selected} onchanged={reload} />
		{/key}
		{#if !mac}<TrackerInboxWrites {source} {writes} onchanged={reload} />{/if}
	{:else if overview && home}
		{@render rows()}
		{#if overview.needsYouCapped}<hx-p class="meta"
				>Showing the most recent blockers on this phone.</hx-p
			>{/if}
	{:else if overview}
		<hx-nav class="filters" aria-label="Filter items">
			{#each tabs as name (name)}
				<hx-button
					type="button"
					class="filter"
					aria-pressed={filter === name}
					data-bucket={name}
					onclick={() => (filter = name)}
				>
					{filterLabel(name)}
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

		{#if filter === 'reminders' && !found}
			<TrackerInboxReminders {...shared} reminders={overview.reminders} />
		{:else if found}
			<hx-h2>Search results</hx-h2>
			{@render rows(
				found,
				'Search results',
				mac ? 'No Tracker items match that search.' : 'Nothing on this phone matches that search.'
			)}
		{:else if filter === 'needs-you'}
			<!-- One rows instance for both states, so an answer's status survives its row leaving. -->
			<hx-section class="needs" aria-labelledby="inbox-needs-title">
				{@render needsHeading()}
				{@render rows()}
				{#if overview.needsYouCapped}
					<hx-p class="meta"
						>Only the most recent Needs you items are on this phone. Search for others.</hx-p
					>
				{/if}
			</hx-section>
		{:else}
			{@render rows()}
		{/if}

		{#if !mac}<TrackerInboxWrites {source} {writes} onchanged={reload} />{/if}
	{:else}
		<hx-p class="meta" role="status"
			>{mac ? 'Loading Tracker items.' : 'Loading the Tracker copy on this phone.'}</hx-p
		>
	{/if}
</hx-section>

<style>
	@import './tracker-inbox.css';
</style>
