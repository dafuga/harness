/** The five kinds of entity the explorer shows, in the order of its navigation. */
export const explorerCategories = [
	'pages',
	'components',
	'functions',
	'configs',
	'services'
] as const;
export type ExplorerCategory = (typeof explorerCategories)[number];

/** The kinds of unit a product is made of, each under the one category it is listed in. */
const kinds = new Map<string, ExplorerCategory>([
	['page', 'pages'],
	['view', 'pages'],
	['component', 'components'],
	['partial', 'components'],
	['layout', 'components'],
	['function', 'functions'],
	['validator', 'functions'],
	['serializer', 'functions'],
	['kernel', 'functions'],
	['helper', 'functions'],
	['decorator', 'functions'],
	['policy', 'functions'],
	['form', 'functions'],
	['config', 'configs'],
	['initializer', 'configs'],
	['service', 'services'],
	['endpoint', 'services'],
	['api', 'services'],
	['adapter', 'services'],
	['repository', 'services'],
	['workflow', 'services'],
	['command', 'services'],
	['controller', 'services'],
	['job', 'services'],
	['channel', 'services'],
	['middleware', 'services'],
	['hook', 'services'],
	['mailer', 'services']
]);

/**
 * The category a kind of unit is listed under. Null for a kind that is none of the five: a rule,
 * a guide, a template, a model, a script or anything unknown is not presented as a function.
 */
export function explorerKindCategory(kind: string): ExplorerCategory | null {
	return kinds.get(kind) ?? null;
}

/** What is shown of one entity; an address without a section shows its overview. */
export const explorerSections = ['details', 'history'] as const;
export type ExplorerSection = (typeof explorerSections)[number];

/** The tabs a section keeps in the query; the first of each is its default and is not written. */
export const explorerTabs = {
	overview: ['overview', 'relationships', 'tests'],
	details: ['contract', 'measurements', 'source'],
	history: []
} as const satisfies Record<string, readonly string[]>;
export type ExplorerTab = (typeof explorerTabs)[keyof typeof explorerTabs][number];

/** One address of the explorer: where it is in history and which entity it shows there. */
export interface ExplorerLocation {
	/** Null for a commit that no branch reaches; no branch is invented for it. */
	branch: string | null;
	/** The full hash of a selected commit; null shows the branch at whatever its tip is. */
	commit: string | null;
	category: ExplorerCategory;
	/** The id of a unit; absent on the index of a category. */
	entity?: string;
	/** Absent for the overview of the entity. */
	section?: ExplorerSection;
	/** A tab of the section other than its default one. */
	tab?: ExplorerTab;
}

const hash = /^[0-9a-f]{40}$/;
const isCategory = (name: string): name is ExplorerCategory =>
	explorerCategories.some((known) => known === name);
const isSection = (name: string): name is ExplorerSection =>
	explorerSections.some((known) => known === name);

function decoded(text: string): string | undefined {
	try {
		return decodeURIComponent(text);
	} catch {
		return undefined;
	}
}

interface Scope {
	branch: string | null;
	commit: string | null;
	rest: string[];
}

/** The branch a path names: null for none, undefined when it cannot be decoded or is empty. */
function branchOf(parts: string[]): string | null | undefined {
	if (parts[0] !== 'branch') return null;
	const name = decoded(parts[1] ?? '');
	return name === '' ? undefined : name;
}

/** The commit the parts after a branch name: null for none, undefined when it is no full hash. */
function commitOf(after: string[]): string | null | undefined {
	if (after[0] !== 'commit') return null;
	return hash.test(after[1] ?? '') ? after[1] : undefined;
}

/** The branch and commit a path starts with, and the parts that follow; a path has one at least. */
function scope(parts: string[]): Scope | undefined {
	const branch = branchOf(parts);
	const after = branch === null ? parts : parts.slice(2);
	const commit = commitOf(after);
	if (branch === undefined || commit === undefined) return undefined;
	if (branch === null && commit === null) return undefined;
	return { branch, commit, rest: commit === null ? after : after.slice(2) };
}

/** The tab a query names, when the shown section has it and it is not the default one. */
function tabOf(location: ExplorerLocation, search: string): ExplorerTab | undefined {
	if (!location.entity) return undefined;
	const [, ...others] = explorerTabs[location.section ?? 'overview'] as readonly ExplorerTab[];
	const asked = new URLSearchParams(search).get('tab');
	return others.find((known) => known === asked);
}

/** The entity and section the parts after a category name; null when they name neither. */
function selection(rest: string[]): Pick<ExplorerLocation, 'entity' | 'section'> | null {
	const [id, section, ...extra] = rest;
	if (id === undefined) return {};
	const entity = decoded(id);
	if (!entity || extra.length > 0) return null;
	if (section === undefined) return { entity };
	return isSection(section) ? { entity, section } : null;
}

/**
 * Reads an address of the explorer, the part after the route it is served under:
 * `/branch/<name>[/commit/<sha>]/<category>[/<entity>[/details|/history]]`. A branch is one
 * encoded segment, and a commit that no branch reaches has the form without one. A branch or a
 * commit alone stands for its Pages. Undefined when the path names no address.
 */
export function explorerRoute(path: string, search = ''): ExplorerLocation | undefined {
	const found = scope(path.replace(/\/+$/, '').split('/').slice(1));
	if (!found) return undefined;
	const [category = 'pages', ...after] = found.rest;
	const selected = isCategory(category) ? selection(after) : null;
	if (!isCategory(category) || !selected) return undefined;
	const { branch, commit } = found;
	const location: ExplorerLocation = { branch, commit, category, ...selected };
	const tab = tabOf(location, search);
	return tab ? { ...location, tab } : location;
}

/** The canonical path of an address, with its tab as a query; every part is one segment. */
export function explorerRoutePath(location: ExplorerLocation): string {
	const branch = location.branch === null ? '' : `/branch/${encodeURIComponent(location.branch)}`;
	const commit = location.commit === null ? '' : `/commit/${location.commit}`;
	const entity = location.entity ? `/${encodeURIComponent(location.entity)}` : '';
	const section = location.entity && location.section ? `/${location.section}` : '';
	const tab = tabOf(location, `tab=${location.tab ?? ''}`);
	const query = tab ? `?tab=${tab}` : '';
	return `${branch}${commit}/${location.category}${entity}${section}${query}`;
}
