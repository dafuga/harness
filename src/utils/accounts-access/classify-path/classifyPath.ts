import type { PathClass } from './classifyPath.types';
import {
	budgetsLedger,
	defaultGlobalFiles,
	pathMatches,
	scenariosDirectory,
	unitsDirectory,
	workloadsDirectory,
	type UnitsConfig
} from '../../../core/development-tooling/unitsConfig';
import { unitIdentity } from './unitIdentity';
import {} from '../unitIdentity';

/** Decides how a repository-relative path participates in the unit graph. */
export function classifyPath(path: string, config: UnitsConfig): PathClass {
	const workspace = owningWorkspace(path, config);
	const relative = workspace.root === '.' ? path : path.slice(workspace.root.length + 1);
	const base = { workspace: workspace.name, workspaceRoot: workspace.root, relative };
	if (isRegistry(path)) return { ...base, classification: 'registry' };
	if (config.ignored.some((pattern) => pathMatches(path, pattern))) {
		return { ...base, classification: 'ignored' };
	}
	if (isGlobal(path, relative, config)) return { ...base, classification: 'global' };
	if (config.tests.some((pattern) => pathMatches(relative, pattern))) {
		return { ...base, classification: 'test' };
	}
	const identity = unitIdentity(relative, workspace.name);
	return identity
		? { ...base, classification: 'source', identity }
		: { ...base, classification: 'other' };
}

function owningWorkspace(path: string, config: UnitsConfig): UnitsConfig['workspaces'][number] {
	const nested = config.workspaces
		.filter((workspace) => workspace.root !== '.' && path.startsWith(`${workspace.root}/`))
		.sort((left, right) => right.root.length - left.root.length);
	return nested[0] ?? config.workspaces.find((workspace) => workspace.root === '.') ?? rootSpace;
}

const rootSpace = { name: '', root: '.' };

function isRegistry(path: string): boolean {
	return (
		path.startsWith(`${unitsDirectory}/`) ||
		path.startsWith(`${scenariosDirectory}/`) ||
		path === budgetsLedger
	);
}

function isGlobal(path: string, relative: string, config: UnitsConfig): boolean {
	return (
		defaultGlobalFiles.includes(relative) ||
		path.startsWith(`${workloadsDirectory}/`) ||
		config.global.some((pattern) => pathMatches(path, pattern))
	);
}

export type { PathClass } from './classifyPath.types';
