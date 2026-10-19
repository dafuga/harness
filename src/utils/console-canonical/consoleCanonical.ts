import { consoleRoute } from './consoleRoute';
import { consoleViews, type ConsoleRoute } from '../consoleRoute';
import { explorerLegacy } from './explorerLegacy';
import { explorerRoute, explorerRoutePath, type ExplorerLocation } from '../explorerRoute';

/** The parts of a history index that say where a commit is. */
export interface IndexedHistory {
	branches: Array<{ name: string; head: string }>;
	revisions: Array<{ commit: string; branches: string[]; retained?: boolean }>;
}

const preferred = ['main', 'master'];

const elsewhere = /^\/(reports|analytics)(\/|$)/;

/** The commit to show first: the one asked for when the index holds it, else a branch head. */
export function defaultCommit(index: IndexedHistory, asked: string): string {
	const known = new Set(index.revisions.map((revision) => revision.commit));
	if (known.has(asked)) return asked;
	const heads = index.branches.filter((branch) => known.has(branch.head));
	const first = heads.find((branch) => preferred.includes(branch.name)) ?? heads[0];
	return first?.head ?? index.revisions[0]?.commit ?? '';
}

/**
 * The branch a commit is shown on when the address names none: the main branch when the commit
 * is on it, else the first branch that contains it. Null when no branch does.
 */
export function commitBranch(index: IndexedHistory, commit: string): string | null {
	const branches = index.revisions.find((item) => item.commit === commit)?.branches ?? [];
	return branches.find((name) => preferred.includes(name)) ?? branches[0] ?? null;
}

/**
 * Where the explorer opens: Pages at the tip of the main branch, else of the first branch whose
 * tip the index holds. A history that only keeps commits no branch reaches opens at one of them.
 */
export function explorerHome(index: IndexedHistory): ExplorerLocation | undefined {
	const known = new Set(index.revisions.map((revision) => revision.commit));
	const heads = index.branches.filter((branch) => known.has(branch.head));
	const first = heads.find((branch) => preferred.includes(branch.name)) ?? heads[0];
	if (first) return { branch: first.name, commit: null, category: 'pages' };
	const commit = index.revisions[0]?.commit;
	return commit ? { branch: null, commit, category: 'pages' } : undefined;
}

/** What a query names, leaving out what it does not say or says wrongly. */
function queried(query: URLSearchParams): Partial<ConsoleRoute> {
	const named = {
		commit: query.get('commit'),
		view: consoleViews.find((known) => known === query.get('view')),
		base: /^[0-9a-f]{40}$/.test(query.get('base') ?? '') ? query.get('base') : null,
		unit: query.get('unit')
	};
	const stated = Object.entries(named).filter(([, value]) => Boolean(value));
	return Object.fromEntries(stated);
}

/**
 * The address an earlier page and query ask for. A commit the index holds is shown as that
 * selected commit; without one the same entity is shown at the tip the explorer opens on.
 */
function requested(
	index: IndexedHistory,
	query: URLSearchParams,
	current: ConsoleRoute | undefined
): ExplorerLocation | undefined {
	const asked: Partial<ConsoleRoute> = { ...current, ...queried(query) };
	const home = explorerHome(index);
	const held = index.revisions.some((revision) => revision.commit === asked.commit);
	if (!home || !asked.commit || !held) {
		const shown = { view: asked.view ?? 'map', unit: asked.unit };
		return home && { ...explorerLegacy({ branch: null, commit: '', ...shown }), ...scope(home) };
	}
	const branch =
		current?.commit === asked.commit ? current.branch : commitBranch(index, asked.commit);
	return explorerLegacy({ ...asked, branch, commit: asked.commit, view: asked.view ?? 'map' });
}

const scope = (location: ExplorerLocation) => ({
	branch: location.branch,
	commit: location.commit
});

/** True for an explorer address that is written exactly as the explorer writes it. */
export function explorerExact(path: string, search = ''): boolean {
	const tail = path.replace(/\/+$/, '');
	const location = explorerRoute(tail, search);
	const tab = new URLSearchParams(search).get('tab');
	return (
		Boolean(location) &&
		explorerRoutePath(location as ExplorerLocation) === (tab === null ? tail : `${tail}?tab=${tab}`)
	);
}

/**
 * The explorer address a console path stands for, when it is not that address already: the
 * root, an earlier page or query, the report and analytics addresses, and a branch or commit
 * alone. Undefined for an address that is already exact, and for one that names nothing.
 */
export function explorerAddress(
	index: IndexedHistory,
	path: string,
	search = ''
): string | undefined {
	const tail = path.replace(/\/+$/, '');
	const query = new URLSearchParams(search);
	const earlier = consoleRoute(tail);
	if (tail === '' || earlier || elsewhere.test(tail)) {
		const location = requested(
			index,
			elsewhere.test(tail) ? new URLSearchParams() : query,
			earlier
		);
		return location && explorerRoutePath(location);
	}
	const location = explorerRoute(tail, search);
	if (!location || explorerExact(tail, search)) return undefined;
	return explorerRoutePath(location);
}

/**
 * Where a console address that is not an explorer address leads, under the route the console is
 * served at. Undefined when the address is exact already, or the index holds no commit.
 */
export function consoleCanonical(
	index: IndexedHistory,
	url: URL,
	base: string
): string | undefined {
	const address = explorerAddress(index, url.pathname.slice(base.length), url.search);
	return address === undefined ? undefined : `${base}${address}`;
}
