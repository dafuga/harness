import { tabOf, type ExplorerTab } from '../explorer-route/explorerTabs';
export { explorerTabs, type ExplorerTab } from '../explorer-route/explorerTabs';

/** The seven kinds of entity the explorer shows, in the order of its navigation. */
export const explorerCategories = [
	'pages',
	'shells',
	'components',
	'functions',
	'configs',
	'services',
	'models'
] as const;
export type ExplorerCategory = (typeof explorerCategories)[number];

/** The kinds of unit a product is made of, each under the one category it is listed in. */
const kinds = new Map<string, ExplorerCategory>([
	['page', 'pages'],
	['view', 'pages'],
	// Only a unit whose manifest declares it a shell: nothing is read from an id or a file name.
	['shell', 'shells'],
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
	['model', 'models'],
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
 * The category a kind of unit is listed under. Null for a kind that is none of the six: a rule,
 * a guide, a template, a script or anything unknown is not presented as a function.
 */
export function explorerKindCategory(kind: string): ExplorerCategory | null {
	return kinds.get(kind) ?? null;
}

/** What is shown of one entity; an address without a section shows its overview. */
export const explorerSections = ['details', 'history'] as const;
export type ExplorerSection = (typeof explorerSections)[number];

/** One address of the explorer: where it is in history and which entity it shows there. */
export interface ExplorerLocation {
	/** Null for a commit that no branch reaches; no branch is invented for it. */
	branch: string | null;
	/** The full hash of a selected commit; null shows the branch at whatever its tip is. */
	commit: string | null;
	category: ExplorerCategory;
	/** The id of a unit; absent on the index of a category. */
	entity?: string;
	/** A callable within its owning unit, resolved at the selected revision. */
	helper?: string;
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
	if (category === 'helpers') return helperSelection(found, after);
	const selected = isCategory(category) ? selection(after) : null;
	if (!isCategory(category) || !selected) return undefined;
	const { branch, commit } = found;
	const location: ExplorerLocation = { branch, commit, category, ...selected };
	const helper = helperOf(location, new URLSearchParams(search).get('helper'));
	if (helper) location.helper = helper;
	const tab = tabOf(location, search);
	return tab ? { ...location, tab } : location;
}

/** Legacy Details links keep their scope and open a tab of the existing entity page. */
export function canonicalExplorerLocation(location: ExplorerLocation): ExplorerLocation {
	if (location.section !== 'details') return location;
	const canonical = { ...location };
	delete canonical.section;
	if (location.tab === 'measurements') delete canonical.tab;
	else canonical.tab = location.tab === 'source' ? 'source' : 'contract';
	return canonical;
}

/** Canonical paths use helper names and tab segments; legacy module tabs remain in the query. */
export function explorerRoutePath(location: ExplorerLocation): string {
	location = canonicalExplorerLocation(location);
	const branch = location.branch === null ? '' : `/branch/${encodeURIComponent(location.branch)}`;
	const commit = location.commit === null ? '' : `/commit/${location.commit}`;
	const callable = helperPath(location);
	if (callable) return `${branch}${commit}${callable}`;
	const entity = location.entity ? `/${encodeURIComponent(location.entity)}` : '';
	const section = location.entity && location.section ? `/${location.section}` : '';
	const tab = tabOf(location, `tab=${location.tab ?? ''}`);
	const params = new URLSearchParams();
	if (tab) params.set('tab', tab);
	const query = params.size ? `?${params}` : '';
	return `${branch}${commit}/${location.category}${entity}${section}${query}`;
}

/** A helper selector belongs only to a function entity, never to a category or visual entity. */
function helperOf(location: ExplorerLocation, helper?: string | null): string | undefined {
	return location.category === 'functions' && location.entity && helper ? helper : undefined;
}

/** Readable callable names may name their owner when the name alone is ambiguous. */
function helperSelection(found: Scope, parts: string[]): ExplorerLocation | undefined {
	const helper = decoded(parts[0] ?? '');
	if (!helper) return undefined;
	const qualified = parts[1] === 'in';
	const entity = qualified ? decoded(parts[2] ?? '') : undefined;
	const rest = parts.slice(qualified ? 3 : 1);
	if ((qualified && !entity) || rest.length > 1) return undefined;
	const location: ExplorerLocation = {
		branch: found.branch,
		commit: found.commit,
		category: 'functions',
		helper
	};
	if (entity) location.entity = entity;
	return helperPane(location, rest[0]);
}

function helperPane(location: ExplorerLocation, pane?: string): ExplorerLocation | undefined {
	if (pane === 'history') return { ...location, section: 'history' };
	if (pane === undefined || pane === 'overview') return location;
	const tab = tabOf(location, `tab=${pane}`);
	return tab ? { ...location, tab } : undefined;
}

function helperPath(location: ExplorerLocation): string | undefined {
	if (location.category !== 'functions' || !location.helper) return undefined;
	const helper = encodeURIComponent(location.helper);
	const owner = location.entity ? `/in/${encodeURIComponent(location.entity)}` : '';
	const tab = tabOf(location, `tab=${location.tab ?? ''}`);
	const pane = location.section === 'history' ? 'history' : tab;
	return `/helpers/${helper}${owner}${pane ? `/${pane}` : ''}`;
}
