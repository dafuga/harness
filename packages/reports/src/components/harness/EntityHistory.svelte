<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type {
		ExplorerEntity,
		ExplorerHistoryDetail,
		ExplorerHistoryRow,
		ExplorerScope
	} from '../../models/Explorer.types';
	import type { HarnessIndex, HarnessRevision } from '../../models/Harness.types';
	import {
		entityHistory,
		historyListed,
		historyProfiles,
		historyVerdict
	} from '../../utils/entityHistory';
	import { entityLens, shortCommit, type EntityNav } from '../../utils/entityLens';
	import { historyDetail } from '../../utils/explorerHistory';
	import type { HarnessClient } from '../../utils/harnessClient';
	import Select from '../Select.svelte';
	import EntityChange from './EntityChange.svelte';
	import EntityHistoryRow from './EntityHistoryRow.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessVerdict from './HarnessVerdict.svelte';
	import RegressionProof from '../RegressionProof.svelte';
	let {
		entity,
		rows,
		index,
		scope,
		known,
		client,
		nav
	}: {
		entity: ExplorerEntity;
		/** The shown commit and its ancestors as the host knows them for this entity, newest first. */
		rows: ExplorerHistoryRow[];
		index: HarnessIndex;
		scope: ExplorerScope;
		/** Revisions already read: the shown commit and, at a selected commit, its parent. */
		known: HarnessRevision[];
		client: Pick<HarnessClient, 'revision'>;
		nav: EntityNav;
	} = $props();
	// What each revision that was read says about this entity; the ones already read are known at once.
	const tells = (detail: HarnessRevision) => historyDetail(detail, entity.id);
	// The component is made anew for another entity or commit, so what it starts with is enough.
	const read = new SvelteMap<string, ExplorerHistoryDetail>(
		untrack(() => known).map((detail) => [detail.commit, tells(detail)])
	);
	const keep = (detail: HarnessRevision) => read.set(detail.commit, tells(detail));
	const fetchOne = (commit: string) => client.revision(commit).then(keep, () => undefined);
	let found = $derived(historyListed(rows, read));
	// The reasons of a listed commit are read when it is listed, never for the whole history.
	$effect(() => {
		for (const row of found.listed.filter((item) => !read.has(item.commit))) {
			void fetchOne(row.commit);
		}
	});
	let reading = $state(false);
	/** Reads the next commits nothing measured, a few at a time, to learn whether they changed it. */
	async function readMore() {
		reading = true;
		await Promise.all(found.unread.slice(0, 10).map((row) => fetchOne(row.commit)));
		reading = false;
	}
	let timings = $derived(entityHistory(index, entity.id, found.listed));
	let profiles = $derived(historyProfiles(timings));
	let profile = $state('');
	let chosen = $state('');
	let shown = $derived(profiles.includes(profile) ? profile : (profiles[0] ?? ''));
	let selected = $derived(
		found.listed.find((row) => row.commit === chosen) ??
			found.listed.find((row) => row.commit === scope.commit) ??
			found.listed[0]
	);
	// Whether the reasons of the shown change are open as they were written.
	let full = $state(false);
	/** Shows a change below the table, with its reasons in full when that was asked for. */
	async function choose(commit: string, whole: boolean) {
		[chosen, full] = [commit, whole];
		if (!whole) return;
		await tick();
		document.querySelector<HTMLElement>('#ex-reasons-full > summary')?.focus();
	}
	// Why the history cannot say what the commits not read yet changed, each reason once.
	let gaps = $derived([...new Set(found.unread.flatMap((row) => (row.gap ? [row.gap] : [])))]);
	const at = (row: ExplorerHistoryRow) =>
		entityLens(nav.route, { category: entity.category, entity: entity.id, commit: row.commit });
	const timing = (row: ExplorerHistoryRow) =>
		(timings.get(row.commit) ?? []).find((item) => item.profile === shown);
	// The verdict of the entity at a commit once its revision is read; the commit's own before that.
	const verdict = (row: ExplorerHistoryRow) =>
		read.get(row.commit)?.verdict ?? historyVerdict(row.coverage);
</script>

<div role="tabpanel" aria-label={`${entity.name} history`} class="ex-stack">
	<RegressionProof
		items={read.get(scope.commit)?.regressions ?? []}
		unit={entity.id}
		href={(commit) =>
			nav.href(
				entityLens(nav.route, {
					commit,
					category: entity.category,
					entity: entity.id,
					tab: 'tests'
				})
			)}
		follow={(commit) =>
			nav.go(
				entityLens(nav.route, {
					commit,
					category: entity.category,
					entity: entity.id,
					tab: 'tests'
				})
			)}
	/>
	<section class="ex-card" aria-labelledby="ex-history-title">
		<header class="ex-evidence-head">
			<div>
				<h2 id="ex-history-title"><HarnessIcon name="history" size={24} /> History</h2>
				<p class="ex-soft">
					Changes to this entity through {shortCommit(scope.commit)}, newest first.
				</p>
			</div>
			{#if profiles.length > 1}
				<label class="ex-profile"
					>Performance profile
					<Select label="Performance profile" bind:value={() => shown, (next) => (profile = next)}>
						{#each profiles as id (id)}<option value={id}>{id}</option>{/each}
					</Select>
				</label>
			{/if}
		</header>
		{#if found.listed.length === 0}
			<p class="ex-gap">
				<HarnessVerdict passed={false} label="No recorded change" />
				<span>No commit read so far is recorded as a change of this entity.</span>
			</p>
		{:else}
			<div class="ex-scroll">
				<table class="ex-table ex-history" aria-label={`History of ${entity.name}`}>
					<thead>
						<tr>
							<th scope="col">Date</th>
							<th scope="col">Commit</th>
							<th scope="col">Behavior change</th>
							<th scope="col">Simplification / performance attempt</th>
							<th scope="col">Size</th>
							<th scope="col">Complexity</th>
							<th scope="col">Timing{shown ? ` (${shown})` : ''}</th>
							<th scope="col">Evidence</th>
							<th scope="col"><span class="ex-hidden">Open</span></th>
						</tr>
					</thead>
					<tbody>
						{#each found.listed as row (row.commit)}
							<EntityHistoryRow
								{row}
								detail={read.get(row.commit)}
								timing={timing(row)}
								verdict={verdict(row)}
								selected={row.commit === selected?.commit}
								viewed={row.commit === scope.commit}
								to={at(row)}
								{nav}
								onselect={(whole) => choose(row.commit, whole)}
							/>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
		{#if found.unread.length}
			<p class="ex-note">
				{found.unread.length} earlier {found.unread.length === 1 ? 'commit does' : 'commits do'} not record
				what {found.unread.length === 1 ? 'it' : 'they'} changed; whether this entity changed there is
				not known until {found.unread.length === 1 ? 'it is' : 'they are'} read.
				{gaps.join(' ')}
				<button type="button" class="ex-text-button" disabled={reading} onclick={readMore}
					>{reading ? 'Reading…' : 'Read the next commits'}</button
				>
			</p>
		{/if}
	</section>
	{#if selected}
		{#if selected.commit !== scope.commit}<RegressionProof
				items={read.get(selected.commit)?.regressions ?? []}
				unit={entity.id}
				href={(commit) =>
					nav.href(
						entityLens(nav.route, {
							commit,
							category: entity.category,
							entity: entity.id,
							tab: 'tests'
						})
					)}
				follow={(commit) =>
					nav.go(
						entityLens(nav.route, {
							commit,
							category: entity.category,
							entity: entity.id,
							tab: 'tests'
						})
					)}
			/>{/if}
		<EntityChange
			row={selected}
			timings={timings.get(selected.commit) ?? []}
			detail={read.get(selected.commit) ?? null}
			{nav}
			bind:full
		/>
	{/if}
</div>
