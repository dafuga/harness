<script lang="ts">
	import { onMount } from 'svelte';
	import { explorerRoutePath, type ExplorerLocation } from '../../../../../src/utils/explorerRoute';
	import type {
		ExplorerBehavior,
		ExplorerEntity,
		ExplorerEvidence
	} from '../../models/Explorer.types';
	import type { ExplorerScreen } from '../../models/ExplorerScreen.types';
	import type { HarnessIndex, HarnessRevision, HarnessUnit } from '../../models/Harness.types';
	import { correctedLocation } from '../../utils/correctedLocation';
	import type { EntityLens } from '../../utils/entityLens';
	import { explorerBehavior } from '../../utils/explorerBehavior';
	import { explorerEntities } from '../../utils/explorerEntities';
	import { explorerSearchEntries } from '../../utils/explorerSearchEntries';
	import { explorerEvidence } from '../../utils/explorerEvidence';
	import { explorerHistory } from '../../utils/explorer-history/explorerHistory';
	import { explorerRelationsReader } from '../../utils/explorerRelations';
	import { branchCommits } from './harness-navbar/harnessAncestry';
	import { retainedBranch } from '../../utils/harnessAncestry';
	import { harnessClient } from '../../utils/harnessClient';
	import { harnessPage } from '../../utils/harness-page/harnessPage';
	import HarnessHeader from './HarnessHeader.svelte';
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
		/** Accepted from earlier hosts and not drawn: the explorer has six categories and no more. */
		links?: Array<{ label: string; href: string }>;
		/** False where the host serves no export endpoint, so no dead link is offered. */
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
	const href = (to: ExplorerLocation) => base + explorerRoutePath(to);
	type Answer = { evidence: ExplorerEvidence; behavior: ExplorerBehavior };
	/** Another category, entity or section starts at its top; a tab of the same page does not. */
	function onroute(to: ExplorerLocation) {
		const next = explorerRoutePath(to);
		navigate(next, false);
		if (next.split('?')[0] !== pathname) window.scrollTo({ top: 0 });
	}
	/** What an entity relates to at a revision; what its commit removed, as the parent held it. */
	function relationsOf(
		detail: HarnessRevision,
		before: HarnessRevision | null,
		listed: ExplorerEntity[]
	) {
		const own = explorerRelationsReader(detail, listed);
		// The parent lists its own entities, with the verdicts it gave them.
		const last = before ? explorerRelationsReader(before) : own;
		const held = new Set(detail.registry.units.map((unit) => unit.id));
		return (id: string) => (held.has(id) ? own : last)(id);
	}
	/** The revisions of exactly the shown commit once both are read; kept while it stays shown. */
	let loaded = $derived(
		head && head.commit === commit && parent !== undefined ? { head, parent } : null
	);
	let entities = $derived(loaded ? explorerEntities(loaded.head, loaded.parent) : []);
	let relations = $derived(loaded ? relationsOf(loaded.head, loaded.parent, entities) : null);
	// What an answer depends on besides the revisions: the tip or a selected commit, and its parent.
	let context = $derived(scope ? `${scope.mode} ${scope.commit} ${scope.parent}` : null);
	// The content asks for an answer whenever it reads one, so each is worked out once for a unit
	// and handed out as the same object until a revision or that context changes.
	let answers = $derived(loaded && context ? new Map<string, Answer>() : null);
	/** Everything the content is given, once the revisions of exactly this scope are read. */
	let shown = $derived.by(() => {
		if (!index || !scope || !loaded || !relations || !answers) return null;
		const [history, at, revisions, known] = [index, scope, loaded, answers];
		const answer = (unit: HarnessUnit) => {
			const found = known.get(unit.id);
			if (found) return found;
			const evidence = explorerEvidence(at, revisions, unit);
			const made = { evidence, behavior: explorerBehavior(evidence) };
			known.set(unit.id, made);
			return made;
		};
		const lens: EntityLens = {
			href,
			relations,
			evidence: (unit) => answer(unit).evidence,
			behavior: (unit) => answer(unit).behavior,
			history: (id) => explorerHistory(history, at, id)
		};
		return { index: history, scope: at, head: revisions.head, parent: revisions.parent, lens };
	});
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
		const corrected = scope?.location ? correctedLocation(scope.location, entities) : null;
		if (corrected) navigate(explorerRoutePath(corrected), true);
	});
</script>

<div class="hx-shell">
	<HarnessHeader
		{base}
		{problem}
		missing={page?.kind === 'missing' ? page : null}
		navbar={{ repository, scope, index, commits, href, onroute, search: searchCatalog }}
	/>
	<main class="hx-main">
		{#if !index && !problem}<p class="hc-muted" role="status">Loading history…</p>{/if}
		{#if index?.truncated}
			<p class="hc-notice">
				Older commits were left out of this index; it says so rather than hide them.
			</p>
		{/if}
		{#if scope && !shown && !problem}
			<p class="hc-muted" role="status">Loading this revision…</p>
		{/if}
		{#if shown}
			{#if !shown.head.registry.available}
				<p class="hc-notice" role="status">
					{shown.head.registry.gap ?? 'No unit registry is stored at this revision'}. The registry
					of another revision is not shown in its place.
				</p>
			{/if}
			<!-- Another category, entity or section opens afresh; a tab of the same page keeps it. -->
			{#key pathname}
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
	</main>
</div>
