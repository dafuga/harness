<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		explorerRoutePath,
		type ExplorerLocation
	} from '../../../../../src/utils/explorer-ui/explorerRoute';
	import type { ExplorerScreen } from '../../models/explorer-ui/ExplorerScreen.types';
	import type { HarnessIndex, HarnessRevision } from '../../models/explorer-ui/Harness.types';
	import {
		correctedLocation,
		compactHelperLocation
	} from '../../utils/development-tooling/correctedLocation';
	import { explorerEntities } from '../../utils/explorer-ui/explorerEntities';
	import { explorerSearchEntries } from '../../utils/explorer-ui/explorerSearchEntries';
	import { branchCommits } from './harness-navbar/harnessAncestry';
	import { retainedBranch } from '../../utils/explorer-ui/harnessAncestry';
	import { harnessClient } from '../../utils/explorer-ui/harnessClient';
	import { harnessPage } from '../../utils/explorer-ui/harness-page/harnessPage';
	import {
		consoleContentKey,
		consoleRelations,
		consoleView,
		type ConsoleAnswer
	} from './harness-console/consoleView';
	import ExplorerLayout from './ExplorerLayout.svelte';
	import LoadingState from '../shared-primitives/LoadingState.svelte';
	let {
		base,
		path,
		navigate,
		exportable = true,
		content
	}: {
		base: string;
		/** The address after `base`, with its query: branch, commit, category, entity and tab. */
		path: string;
		/** Goes to another page; `replace` when the address only becomes more exact. */
		navigate: (path: string, replace: boolean) => void;
		links?: Array<{ label: string; href: string }>;
		exportable?: boolean;
		/** What renders the screen. The host has no renderer of its own: whoever mounts it names one. */
		content: ExplorerScreen;
	} = $props();
	let Content = $derived(content);
	let client = $derived(harnessClient(base));
	// What is read is never changed in place, so it is held as read and not made reactive inside.
	let index = $state.raw<HarnessIndex | null>(null);
	let repository = $state<string | null>(null);
	let problem = $state('');
	let head = $state.raw<HarnessRevision | null>(null);
	/** Undefined while the first parent is being read; null when there is none to read. */
	let parent = $state.raw<HarnessRevision | null | undefined>(null);
	let pathname = $derived(path.split('?')[0]);
	let search = $derived(path.slice(pathname.length));
	let page = $derived(index ? harnessPage(index, pathname, search) : null);
	let scope = $derived(page?.kind === 'page' ? page.scope : null);
	// Each address makes another scope; what follows from only its commit or branch waits for those.
	let commit = $derived(scope?.commit ?? null);
	let branch = $derived(scope ? (scope.branch ?? retainedBranch) : null);
	let commits = $derived(index && branch !== null ? branchCommits(index, branch) : []);
	// The first parent is read only where a selected commit is compared, and only if it is held.
	let wanted = $derived.by(() => {
		const first = scope?.mode === 'commit' ? scope.parent : null;
		return first && index?.revisions.some((item) => item.commit === first) ? first : null;
	});
	function address(to: ExplorerLocation) {
		const local = to.branch === scope?.branch && to.commit === scope?.location.commit;
		return explorerRoutePath(local ? compactHelperLocation(to, entities) : to);
	}
	const href = (to: ExplorerLocation) => base + address(to);
	/** Another category, entity or section starts at its top; a tab of the same page does not. */
	function onroute(to: ExplorerLocation) {
		const next = address(to);
		navigate(next, false);
		const from = shown?.scope.location ?? scope?.location;
		if (
			['category', 'screen', 'entity', 'helper', 'section'].some(
				(key) => to[key as keyof ExplorerLocation] !== from?.[key as keyof ExplorerLocation]
			)
		)
			window.scrollTo({ top: 0 });
	}
	/** The revisions of exactly the shown commit once both are read; kept while it stays shown. */
	let loaded = $derived(
		head && head.commit === commit && parent !== undefined ? { head, parent } : null
	);
	let entities = $derived(loaded ? explorerEntities(loaded.head, loaded.parent) : []);
	let relations = $derived(loaded ? consoleRelations(loaded.head, loaded.parent, entities) : null);
	// What an answer depends on besides the revisions: the tip or a selected commit, and its parent.
	let context = $derived(scope ? `${scope.mode} ${scope.commit} ${scope.parent}` : null);
	// The content asks for an answer whenever it reads one, so each is worked out once for a unit
	// and handed out as the same object until a revision or that context changes.
	let answers = $derived(loaded && context ? new Map<string, ConsoleAnswer>() : null);
	/** Everything the content is given, once the revisions of exactly this scope are read. */
	let shown = $derived(
		index && scope && loaded && relations && answers
			? consoleView({ index, scope, loaded, entities, relations, answers, href })
			: null
	);

	let contentKey = $derived(consoleContentKey(shown?.scope.location));

	// The search of the bar holds the entities of exactly the revision shown; none while it is read.
	let searchCatalog = $derived({
		entries: loaded ? explorerSearchEntries(entities, loaded.head.commit) : null
	});

	onMount(async () => {
		try {
			index = await client.index();
		} catch (reason) {
			problem = reason instanceof Error ? reason.message : 'The history could not be loaded.';
		}
		// The name of the repository this history was built from; a history without one names none.
		repository = await client.activity().then(
			(activity) => activity.repository.name,
			() => null
		);
	});

	$effect(() => {
		if (page?.kind === 'redirect') navigate(page.path, true);
	});
	// The detail of a revision is fetched when that revision is looked at, never in advance. Only
	// another commit or history reads again: a tab or category of the same commit keeps its detail.
	$effect(() => {
		const [at, from] = [commit, client];
		if (!at) return;
		head = null;
		problem = '';
		// An answer for a commit that is no longer looked at, or from another history, is dropped.
		const live = () => at === commit && from === client;
		void from.revision(at).then(
			(detail) => {
				if (live()) head = detail;
			},
			(reason: unknown) => {
				if (live()) problem = reason instanceof Error ? reason.message : String(reason);
			}
		);
	});
	$effect(() => {
		const [at, from] = [wanted, client];
		parent = at ? undefined : null;
		if (!at) return;
		const live = () => at === wanted && from === client;
		void from.revision(at).then(
			(detail) => {
				if (live()) parent = detail;
			},
			() => {
				if (live()) parent = null;
			}
		);
	});
	// An entity is addressed under the category it has at this revision; the address is corrected.
	$effect(() => {
		if (!scope || !loaded) return;
		const corrected = correctedLocation(scope.location, entities) ?? scope.location;
		const canonical = address(corrected);
		if (canonical !== pathname + search) navigate(canonical, true);
	});
</script>

<!-- The console reads and chooses; the frame draws. Its marker draws no box around that frame. -->
<hx-div class="hx-console" data-harness-component="harness-harness-console">
	<ExplorerLayout
		{base}
		{problem}
		missing={page?.kind === 'missing' ? page : null}
		navbar={{
			repository,
			scope: shown?.scope ?? scope,
			index,
			commits,
			href,
			onroute,
			search: searchCatalog
		}}
	>
		{#if !index && !problem}<LoadingState label="Loading history…" />{/if}

		{#if scope && !shown && !problem}
			<LoadingState label="Loading this revision…" />
		{/if}
		{#if shown}
			{#if !shown.head.registry.available}
				<hx-p class="hc-notice" role="status">
					{shown.head.registry.gap ?? 'No unit registry is stored at this revision'}. The registry
					of another revision is not shown in its place.
				</hx-p>
			{/if}
			<!-- Another category, entity or section opens afresh; a tab of the same page keeps it. -->
			{#key contentKey}
				<Content
					index={shown.index}
					head={shown.head}
					parent={shown.parent}
					scope={shown.scope}
					route={shown.scope.location}
					{entities}
					lens={shown.lens}
					{client}
					mediaBase={base + '/media/'}
					{onroute}
					exportHref={exportable ? base + '/export/' + shown.scope.commit : ''}
				/>
			{/key}
		{/if}
	</ExplorerLayout>
</hx-div>

<style>
	.hx-console {
		display: contents;
	}
</style>
