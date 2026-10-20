import type { ConsoleRoute, ConsoleView } from '../consoleRoute';
import { consoleViews } from '../consoleRoute';

const hash = '[0-9a-f]{40}';

const shape = new RegExp(`^(?:/branch/(.+))?/commit/(${hash})(?:/(.*))?$`);

const exact = new RegExp(`^${hash}$`);

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
