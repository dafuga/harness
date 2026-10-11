<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { commitBranch } from '../../../../../src/utils/consoleCanonical';
	import {
		consoleRoutePath,
		type ConsoleRoute,
		type ConsoleView
	} from '../../../../../src/utils/consoleRoute';
	import type { HarnessIndex, HarnessRevision } from '../../models/Harness.types';
	import { branchCommits, harnessAncestry, retainedBranch } from '../../utils/harnessAncestry';
	import { harnessClient } from '../../utils/harnessClient';
	import { harnessPage } from '../../utils/harnessPage';
	import HarnessCompare from './HarnessCompare.svelte';
	import HarnessGrowth from './HarnessGrowth.svelte';
	import HarnessHeader from './HarnessHeader.svelte';
	import HarnessHistory from './HarnessHistory.svelte';
	import HarnessLegacy from './HarnessLegacy.svelte';
	import HarnessMap from './HarnessMap.svelte';
	import HarnessSelectors from './HarnessSelectors.svelte';
	import HarnessUnitView from './HarnessUnit.svelte';
	let {
		base,
		path,
		navigate,
		links = [],
		exportable = true
	}: {
		base: string;
		/** The address after `base`: each branch, commit, view and selection is its own path. */
		path: string;
		/** Goes to another page; `replace` when the address only becomes more exact. */
		navigate: (path: string, replace: boolean) => void;
		links?: Array<{ label: string; href: string }>;
		/** False where the host serves no export endpoint, so no dead link is offered. */
		exportable?: boolean;
	} = $props();
	const views: Array<[ConsoleView, string]> = [
		['map', 'Component map'],
		['compare', 'Compare'],
		['history', 'History'],
		['growth', 'Growth']
	];
	let client = $derived(harnessClient(base));
	let mediaBase = $derived(base + '/media/');
	let index = $state<HarnessIndex | null>(null);
	let problem = $state('');
	let head = $state<HarnessRevision | null>(null);
	let before = $state<HarnessRevision | undefined>(undefined);
	let page = $derived(index ? harnessPage(index, path) : null);
	let route = $derived(page?.kind === 'page' ? page.route : null);
	let summary = $derived(page?.kind === 'page' ? page.summary : undefined);
	let commit = $derived(route?.commit ?? '');
	let view = $derived<ConsoleView>(route?.view ?? 'map');
	let unit = $derived(route?.unit ?? null);
	let branch = $derived(route ? (route.branch ?? retainedBranch) : '');
	let commits = $derived(index && route ? branchCommits(index, branch) : []);
	let ancestors = $derived(index && commit ? harnessAncestry(index, commit) : new Set<string>());
	let bases = $derived((index?.revisions ?? []).filter((item) => ancestors.has(item.commit)));
	// Without a base in the address a comparison starts from what the commit was judged against.
	let from = $derived(
		route?.base ?? head?.comparison?.base ?? head?.sourceImpact?.base ?? summary?.parents[0] ?? ''
	);
	let active = $derived((head?.registry.units ?? []).filter((item) => item.status === 'active'));
	let chosen = $derived(active.find((item) => item.id === unit));

	onMount(async () => {
		try {
			index = await client.index();
		} catch (reason) {
			problem = reason instanceof Error ? reason.message : 'The history could not be loaded.';
		}
	});

	function go(changes: Partial<ConsoleRoute>, replace = false) {
		if (route) navigate(consoleRoutePath({ ...route, ...changes }), replace);
	}
	$effect(() => {
		if (page?.kind === 'redirect') navigate(page.path, true);
	});
	// The base that is shown becomes part of the address, so the comparison can be linked to.
	$effect(() => {
		if (
			view === 'compare' &&
			route &&
			!route.base &&
			head?.commit === commit &&
			ancestors.has(from)
		) {
			go({ base: from }, true);
		}
	});
	// The detail of a revision is fetched when that revision is looked at, never in advance.
	$effect(() => {
		if (!commit) return;
		const wanted = commit;
		head = null;
		void client.revision(wanted).then(
			(detail) => {
				if (wanted === commit) head = detail;
			},
			(reason: unknown) => (problem = reason instanceof Error ? reason.message : String(reason))
		);
	});
	$effect(() => {
		before = undefined;
		if (view !== 'compare' || !from) return;
		const wanted = from;
		void client.revision(wanted).then((detail) => {
			if (wanted === from) before = detail;
		});
	});

	const select = (id: string) => go({ unit: id });
	// A chosen unit is brought into view once its details exist, however it was chosen.
	$effect(() => {
		if (!chosen) return;
		void tick().then(() =>
			document
				.querySelector('[aria-label="Component details"]')
				?.scrollIntoView({ block: 'nearest' })
		);
	});
	/** A branch opens at its newest commit; a commit on no branch keeps no branch. */
	function switchBranch(name: string) {
		const first = index ? branchCommits(index, name)[0] : undefined;
		if (first) go({ branch: name === retainedBranch ? null : name, commit: first.commit });
	}
	function open(wanted: string, to: ConsoleView = view) {
		if (index)
			go({ branch: commitBranch(index, wanted), commit: wanted, view: to, base: undefined });
	}
</script>

<div class="hc-shell">
	<HarnessHeader {base} {links} {problem} missing={page?.kind === 'missing' ? page : null} />
	{#if !index && !problem}<p class="hc-muted" role="status">Loading history…</p>{/if}
	{#if index && route}
		<HarnessSelectors
			{index}
			{branch}
			{commit}
			{commits}
			bases={view === 'compare' ? bases : null}
			{from}
			onbranch={switchBranch}
			oncommit={(wanted) => go({ commit: wanted })}
			onbase={(wanted) => go({ base: wanted })}
		/>
		<div class="hc-tabs" role="tablist" aria-label="Views">
			{#each views as [id, title] (id)}
				<button
					type="button"
					role="tab"
					aria-selected={view === id}
					onclick={() => go({ view: id })}>{title}</button
				>
			{/each}
		</div>
		<div class="hc-panel" role="tabpanel">
			{#if view === 'growth'}
				<HarnessGrowth
					{index}
					{client}
					{unit}
					onunit={(id) => go({ unit: id })}
					oncompare={(wanted) => open(wanted, 'compare')}
				/>
			{:else if !head || !summary}
				<p class="hc-muted" role="status">Loading this revision…</p>
			{:else if view === 'history'}
				<HarnessHistory
					{summary}
					detail={head}
					{mediaBase}
					exportHref={exportable ? base + '/export/' + commit : ''}
					record={route.record ?? null}
					onrecord={(id) => go({ record: id })}
				/>
				{#if index.legacy.length}
					<HarnessLegacy
						reports={index.legacy}
						{commit}
						known={new Set(index.revisions.map((item) => item.commit))}
						{mediaBase}
						onselect={open}
					/>
				{/if}
			{:else if !head.registry.available}
				<p class="hc-notice">
					{head.registry.gap ?? 'No unit registry is stored at this revision'}. The map of another
					revision is not shown in its place.
				</p>
			{:else if view === 'compare'}
				<HarnessCompare
					base={before}
					{head}
					{client}
					{mediaBase}
					selected={unit}
					onselect={select}
				/>
			{:else}
				<HarnessMap units={active} selected={unit} onselect={select} />
				{#if chosen}
					<HarnessUnitView
						unit={chosen}
						units={active}
						scenarios={head.registry.scenarios}
						records={head.records}
						onselect={select}
					/>
				{/if}
			{/if}
		</div>
	{/if}
</div>
