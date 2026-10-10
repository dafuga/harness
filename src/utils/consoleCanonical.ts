import { consoleRoute, consoleRoutePath, consoleViews, type ConsoleRoute } from './consoleRoute';

/** The parts of a history index that say where a commit is. */
export interface IndexedHistory {
	branches: Array<{ name: string; head: string }>;
	revisions: Array<{ commit: string; branches: string[]; retained?: boolean }>;
}

const preferred = ['main', 'master'];

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
 * Where a console address that is not a page path leads: the root goes to the newest commit of
 * the main branch, and the earlier query form (`?view=&commit=&base=&unit=`) to the page it
 * named. Undefined when the address already is a page path, or the index holds no commit.
 */
export function consoleCanonical(
	index: IndexedHistory,
	url: URL,
	base: string
): string | undefined {
	const tail = url.pathname.slice(base.length).replace(/\/+$/, '');
	const current = consoleRoute(tail);
	if (tail !== '' && !(current && legacyQuery(url))) return undefined;
	const route = requested(index, url.searchParams, current);
	return route ? `${base}${consoleRoutePath(route)}` : undefined;
}

function legacyQuery(url: URL): boolean {
	return ['view', 'commit', 'base', 'unit'].some((name) => url.searchParams.has(name));
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

/** The page a query asks for, on top of the page the path already names, if it names one. */
function requested(
	index: IndexedHistory,
	query: URLSearchParams,
	current: ConsoleRoute | undefined
): ConsoleRoute | undefined {
	const asked: Partial<ConsoleRoute> = { ...current, ...queried(query) };
	const commit = defaultCommit(index, asked.commit ?? '');
	if (!commit) return undefined;
	const kept = current?.commit === commit ? current.branch : commitBranch(index, commit);
	const chosen = {
		...(asked.base ? { base: asked.base } : {}),
		...(asked.unit ? { unit: asked.unit } : {})
	};
	return { branch: kept, commit, view: asked.view ?? 'map', ...chosen };
}
