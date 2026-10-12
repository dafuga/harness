<script lang="ts">
	import { onMount } from 'svelte';
	import {
		explorerRoutePath,
		type ExplorerLocation
	} from '../../../../../src/utils/explorerRoute';
	import type { ExplorerBehavior, ExplorerEvidence } from '../../models/Explorer.types';
	import type { ExplorerScreen } from '../../models/ExplorerScreen.types';
	import type { HarnessIndex, HarnessRevision, HarnessUnit } from '../../models/Harness.types';
	import type { EntityLens } from '../../utils/entityLens';
	import { explorerBehavior } from '../../utils/explorerBehavior';
	import { explorerEntities } from '../../utils/explorerEntities';
	import { explorerEvidence } from '../../utils/explorerEvidence';
	import { explorerHistory } from '../../utils/explorerHistory';
	import { explorerRelations } from '../../utils/explorerRelations';
	import { branchCommits, retainedBranch } from '../../utils/harnessAncestry';
	import { harnessClient } from '../../utils/harnessClient';
	import { harnessPage } from '../../utils/harnessPage';
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
		/** Accepted from earlier hosts and not drawn: the explorer has five categories and no more. */
		links?: Array<{ label: string; href: string }>;
		/** False where the host serves no export endpoint, so no dead link is offered. */
		exportable?: boolean;
		/** What renders the screen. The host has no renderer of its own: whoever mounts it names one. */
		content: ExplorerScreen;
	} = $props();
	let Content = $derived(content);
	let client = $derived(harnessClient(base));
	let index = $state<HarnessIndex | null>(null);
	let repository = $state<string | null>(null);
	let problem = $state('');
	let head = $state<HarnessRevision | null>(null);
	/** Undefined while the first parent is being read; null when there is none to read. */
	let parent = $state<HarnessRevision | null | undefined>(null);
	let pathname = $derived(path.split('?')[0]);
	let search = $derived(path.slice(pathname.length));
	let page = $derived(index ? harnessPage(index, pathname, search) : null);
	let scope = $derived(page?.kind === 'page' ? page.scope : null);
	let commits = $derived(
		index && scope ? branchCommits(index, scope.branch ?? retainedBranch) : []
	);
	// The first parent is read only where a selected commit is compared, and only if it is held.
	let wanted = $derived.by(() => {
		const first = scope?.mode === 'commit' ? scope.parent : null;
		return first && index?.revisions.some((item) => item.commit === first) ? first : null;
	});
	const href = (to: ExplorerLocation) => base + explorerRoutePath(to);
	const held = (detail: HarnessRevision, id: string) =>
		detail.registry.units.some((unit) => unit.id === id);
	/** Another category, entity or section starts at its top; a tab of the same page does not. */
	function onroute(to: ExplorerLocation) {
		const next = explorerRoutePath(to);
		navigate(next, false);
		if (next.split('?')[0] !== pathname) window.scrollTo({ top: 0 });
	}
	/** Everything the content is given, once the revisions of exactly this scope are read. */
	let shown = $derived.by(() => {
		if (!index || !scope || head?.commit !== scope.commit || parent === undefined) return null;
		const [history, at, detail] = [index, scope, head];
		const revisions = { head: detail, parent };
		// The content asks for an answer whenever it reads one, so each is worked out once for a
		// unit and handed out as the same object until the scope or a revision changes.
		const answers = new Map<string, { evidence: ExplorerEvidence; behavior: ExplorerBehavior }>();
		const answer = (unit: HarnessUnit) => {
			const known = answers.get(unit.id);
			if (known) return known;
			const evidence = explorerEvidence(at, revisions, unit);
			const found = { evidence, behavior: explorerBehavior(evidence) };
			answers.set(unit.id, found);
			return found;
		};
		const lens: EntityLens = {
			href,
			// What a commit removed is related to what its parent held, where it last was.
			relations: (id) => explorerRelations(held(detail, id) ? detail : (parent ?? detail), id),
			evidence: (unit) => answer(unit).evidence,
			behavior: (unit) => answer(unit).behavior,
			history: (id) => explorerHistory(history, at, id)
		};
		return { index: history, scope: at, head: detail, parent, lens };
	});
	let entities = $derived(shown ? explorerEntities(shown.head, shown.parent) : []);

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
	// The detail of a revision is fetched when that revision is looked at, never in advance.
	$effect(() => {
		const commit = scope?.commit;
		if (!commit) return;
		head = null;
		void client.revision(commit).then(
			(detail) => {
				if (commit === scope?.commit) head = detail;
			},
			(reason: unknown) => (problem = reason instanceof Error ? reason.message : String(reason))
		);
	});
	$effect(() => {
		const commit = wanted;
		parent = commit ? undefined : null;
		if (!commit) return;
		void client.revision(commit).then(
			(detail) => {
				if (commit === wanted) parent = detail;
			},
			() => {
				if (commit === wanted) parent = null;
			}
		);
	});
	// An entity is addressed under the category it has at this revision; the address is corrected.
	$effect(() => {
		const at = scope?.location;
		const found = at?.entity ? entities.find((item) => item.id === at.entity) : undefined;
		if (at && found && found.category !== at.category) {
			navigate(explorerRoutePath({ ...at, category: found.category }), true);
		}
	});
</script>

<div class="hx-shell">
	<HarnessHeader
		{base}
		{problem}
		missing={page?.kind === 'missing' ? page : null}
		navbar={{ repository, scope, index, commits, href, onroute }}
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
					{shown.head.registry.gap ?? 'No unit registry is stored at this revision'}. The registry of
					another revision is not shown in its place.
				</p>
			{/if}
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
		{/if}
	</main>
</div>
