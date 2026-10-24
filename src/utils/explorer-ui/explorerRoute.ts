import type {
	ExplorerSection,
	Scope,
	Selection,
	ExplorerLocation,
	ExplorerScreen
} from './explorerRoute.types';
import { tabOf, explorerCategories, type ExplorerCategory } from '../explorer-route/explorerTabs';
export {
	explorerTabs,
	explorerKindCategory,
	explorerEntityCategories,
	explorerCategories,
	type ExplorerCategory,
	type ExplorerTab
} from '../explorer-route/explorerTabs';

export const explorerSections = ['details', 'history'] as const;

const categoryAlias = new Map([['shells', 'layouts']]);
const canonicalCategory = (name: string) => categoryAlias.get(name) ?? name;
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
/** The entity and supported section after a category name. */
function selection(rest: string[], allowSections = true): Selection {
	const [id, section, ...extra] = rest;
	if (id === undefined) return {};
	const entity = decoded(id);
	if (!entity || extra.length > 0) return null;
	if (section === undefined) return { entity };
	return allowSections && isSection(section) ? { entity, section } : null;
}

/** Reads a scoped explorer address; branch or commit alone opens Pages. */
export function explorerRoute(path: string, search = ''): ExplorerLocation | undefined {
	const found = scope(path.replace(/\/+$/, '').split('/').slice(1));
	if (!found) return undefined;
	const [requested = 'pages', ...after] = found.rest;
	const category = canonicalCategory(requested);
	if (category === 'helpers') return helperSelection(found, after);
	if (category === 'styles' || category === 'dependencies') return screenSelection(found, category);
	if (!isCategory(category)) return undefined;
	const selected = selection(after, category !== 'platforms');
	if (!selected) return undefined;
	const { branch, commit } = found;
	const location: ExplorerLocation = { branch, commit, category, ...selected };
	const helper = helperOf(location, new URLSearchParams(search).get('helper'));
	if (helper) location.helper = helper;
	const tab = tabOf(location, search);
	return tab ? { ...location, tab } : location;
}

function screenSelection(found: Scope, screen: ExplorerScreen): ExplorerLocation | undefined {
	if (found.rest.length !== 1) return undefined;
	return { branch: found.branch, commit: found.commit, category: 'pages', screen };
}

/** Legacy Details links keep their scope and open a tab of the existing entity page. */
export function canonicalExplorerLocation(location: ExplorerLocation): ExplorerLocation {
	if (location.section !== 'details') return location;
	const canonical = { ...location };
	delete canonical.section;
	if (location.tab === 'measurements') delete canonical.tab;
	else if (
		location.tab === 'source' ||
		(location.category === 'models' && location.tab === 'table')
	)
		canonical.tab = location.tab;
	else canonical.tab = location.category === 'pages' ? 'models' : 'contract';
	return canonical;
}

/** Canonical paths use helper names and tab segments; legacy module tabs remain in the query. */
export function explorerRoutePath(location: ExplorerLocation): string {
	location = canonicalExplorerLocation(location);
	const branch = location.branch === null ? '' : `/branch/${encodeURIComponent(location.branch)}`;
	const commit = location.commit === null ? '' : `/commit/${location.commit}`;
	const callable = specialPath(location);
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

function specialPath(location: ExplorerLocation): string | undefined {
	if (location.screen === 'styles' || location.screen === 'dependencies')
		return `/${location.screen}`;
	if (location.category !== 'functions' || !location.helper) return undefined;
	const helper = encodeURIComponent(location.helper);
	const owner = location.entity ? `/in/${encodeURIComponent(location.entity)}` : '';
	const tab = tabOf(location, `tab=${location.tab ?? ''}`);
	const pane = location.section === 'history' ? 'history' : tab;
	return `/helpers/${helper}${owner}${pane ? `/${pane}` : ''}`;
}

export type { ExplorerScreen, ExplorerSection, ExplorerLocation } from './explorerRoute.types';
