export const consoleViews = ['map', 'compare', 'history', 'growth'] as const;
export type ConsoleView = (typeof consoleViews)[number];

/** One page of the console: where it is in history and what is selected on it. */
export interface ConsoleRoute {
	/** Null for a commit that no branch reaches; no branch is invented for it. */
	branch: string | null;
	commit: string;
	view: ConsoleView;
	/** The commit a comparison starts from. */
	base?: string;
	/** The verification record shown in the history view. */
	record?: string;
	unit?: string;
}

const hash = '[0-9a-f]{40}';
const shape = new RegExp(`^(?:/branch/(.+))?/commit/(${hash})(?:/(.*))?$`);
const exact = new RegExp(`^${hash}$`);
const encode = (text: string) => text.split('/').map(encodeURIComponent).join('/');

function decoded(text: string): string | undefined {
	try {
		return decodeURIComponent(text);
	} catch {
		return undefined;
	}
}

/** The value after a keyword in the rest of a path, as `…/unit/<id>` or `…/record/<id>`. */
function after(parts: string[], keyword: string): string | undefined {
	const at = parts.indexOf(keyword);
	return at >= 0 && parts[at + 1] ? decoded(parts[at + 1]) : undefined;
}

/**
 * Reads the path of a console page, the part after the route it is served under:
 * `/branch/<name>/commit/<sha>/<view>`, or `/commit/<sha>/<view>` for a commit on no branch.
 * A comparison may add its base, a history view its record, and any view the selected unit.
 * A branch name keeps its slashes; the commit marker is searched from the right. Undefined
 * when the path names no page.
 */
export function consoleRoute(path: string): ConsoleRoute | undefined {
	const matched = shape.exec(path.replace(/\/+$/, ''));
	if (!matched) return undefined;
	const branch = matched[1] === undefined ? null : decoded(matched[1]);
	const [name, ...rest] = (matched[3] ?? '').split('/');
	const view = consoleViews.find((known) => known === name);
	if (branch === undefined || !view) return undefined;
	return { branch, commit: matched[2], view, ...selection(view, rest) };
}

/** What the rest of a path selects on a view; parts that do not belong to it are ignored. */
function selection(view: ConsoleView, rest: string[]): Partial<ConsoleRoute> {
	const base = view === 'compare' && exact.test(rest[0] ?? '') ? rest[0] : undefined;
	const record = view === 'history' ? after(rest, 'record') : undefined;
	const unit = after(rest, 'unit');
	return { ...(base ? { base } : {}), ...(record ? { record } : {}), ...(unit ? { unit } : {}) };
}

/** The canonical path of a console page; every part is encoded, slashes of a branch are kept. */
export function consoleRoutePath(route: ConsoleRoute): string {
	const branch = route.branch === null ? '' : `/branch/${encode(route.branch)}`;
	const base = route.view === 'compare' && route.base ? `/${route.base}` : '';
	const record =
		route.view === 'history' && route.record ? `/record/${encodeURIComponent(route.record)}` : '';
	const unit = route.unit ? `/unit/${encodeURIComponent(route.unit)}` : '';
	return `${branch}/commit/${route.commit}/${route.view}${base}${record}${unit}`;
}
