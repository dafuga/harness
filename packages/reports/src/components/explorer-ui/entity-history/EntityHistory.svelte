<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type {
		ExplorerEntity,
		ExplorerHistoryDetail,
		ExplorerHistoryRow,
		ExplorerScope
	} from '../../../models/explorer-ui/Explorer.types';
	import type { HarnessIndex, HarnessRevision } from '../../../models/explorer-ui/Harness.types';
	import { entityHistory, historyListed, historyProfiles } from './entityHistory';
	import { entityLens, type EntityNav } from '../../../utils/explorer-ui/entityLens';
	import { shortCommit } from '../../../helpers/strings/shortCommit';
	import { historyDetail } from './explorerHistory';
	import type { HarnessClient } from '../../../utils/explorer-ui/harnessClient';
	import Select from '../../shared-primitives/Select.svelte';
	import EntityHistoryRow from '../entity-history-row/EntityHistoryRow.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
	import HarnessVerdict from '../harness-verdict/HarnessVerdict.svelte';
	import RegressionProof from '../../verification-evidence/RegressionProof.svelte';
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
	let shown = $derived(profiles.includes(profile) ? profile : (profiles[0] ?? ''));
	// Why the history cannot say what the commits not read yet changed, each reason once.
	let gaps = $derived([...new Set(found.unread.flatMap((row) => (row.gap ? [row.gap] : [])))]);
	const at = (row: ExplorerHistoryRow) =>
		entityLens(nav.route, { category: entity.category, entity: entity.id, commit: row.commit });
	const timing = (row: ExplorerHistoryRow) =>
		(timings.get(row.commit) ?? []).find((item) => item.profile === shown);
</script>

<hx-div
	role="tabpanel"
	aria-label={`${entity.name} history`}
	class="ex-stack"
	data-harness-component="harness-entity-history"
>
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
	<hx-section class="ex-card" aria-labelledby="ex-history-title">
		<hx-header class="ex-evidence-head">
			<hx-div>
				<hx-h2 id="ex-history-title"><HarnessIcon name="history" size={24} /> History</hx-h2>
				<hx-p class="ex-soft">
					Changes to this entity through {shortCommit(scope.commit)}, newest first.
				</hx-p>
			</hx-div>
			{#if profiles.length > 1}
				<hx-label class="ex-profile"
					>Performance profile
					<Select label="Performance profile" bind:value={() => shown, (next) => (profile = next)}>
						{#each profiles as id (id)}<hx-option value={id}>{id}</hx-option>{/each}
					</Select>
				</hx-label>
			{/if}
		</hx-header>
		{#if found.listed.length === 0}
			<hx-p class="ex-gap">
				<HarnessVerdict passed={false} label="No recorded change" />
				<hx-span>No commit read so far is recorded as a change of this entity.</hx-span>
			</hx-p>
		{:else}
			<hx-div class="ex-scroll">
				<hx-table class="ex-table ex-history" aria-label={`History of ${entity.name}`}>
					<hx-thead>
						<hx-tr>
							<hx-th scope="col">Date</hx-th>
							<hx-th scope="col">Commit</hx-th>
							<hx-th scope="col">Behavior change</hx-th>
							<hx-th scope="col">Size</hx-th>
							<hx-th scope="col">Complexity</hx-th>
							<hx-th scope="col">Latency{shown ? ` (${shown})` : ''}</hx-th>
						</hx-tr>
					</hx-thead>
					<hx-tbody>
						{#each found.listed as row (row.commit)}
							<EntityHistoryRow
								{row}
								detail={read.get(row.commit)}
								timing={timing(row)}
								viewed={row.commit === scope.commit}
								to={at(row)}
								{nav}
							/>
						{/each}
					</hx-tbody>
				</hx-table>
			</hx-div>
		{/if}
		{#if found.unread.length}
			<hx-p class="ex-note">
				{found.unread.length} earlier {found.unread.length === 1 ? 'commit does' : 'commits do'} not record
				what {found.unread.length === 1 ? 'it' : 'they'} changed; whether this entity changed there is
				not known until {found.unread.length === 1 ? 'it is' : 'they are'} read.
				{gaps.join(' ')}
				<hx-button type="button" class="ex-text-button" disabled={reading} onclick={readMore}
					>{reading ? 'Reading…' : 'Read the next commits'}</hx-button
				>
			</hx-p>
		{/if}
	</hx-section>
</hx-div>
