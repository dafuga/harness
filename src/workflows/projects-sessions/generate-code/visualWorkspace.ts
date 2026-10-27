import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fail } from '../../../core/development-tooling/errors';
import { unitsConfigFile, unitsConfigSchema } from '../../../core/development-tooling/unitsConfig';
import type { UnitsConfig } from '../../../core/development-tooling/unitsConfig';
import {
	verifyConfigFile,
	verifyConfigSchema
} from '../../../core/verification-evidence/verifyTypes';
import { classifyPath } from '../../../utils/accounts-access/classify-path/classifyPath';
import type { VisualWorkspace } from './visualWorkspace.types';

/** Find the nearest Harness registry and its exact workspace for a visual scaffold. */
export function visualWorkspace(directory: string): VisualWorkspace | undefined {
	const target = resolve(directory);
	let registryRoot = target;
	for (;;) {
		const file = join(registryRoot, unitsConfigFile);
		if (existsSync(file)) return configuredWorkspace(registryRoot, target, file);
		const parent = dirname(registryRoot);
		if (parent === registryRoot || existsSync(join(registryRoot, '.git'))) return undefined;
		registryRoot = parent;
	}
}

function configuredWorkspace(registryRoot: string, target: string, file: string): VisualWorkspace {
	const config = unitsConfigSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
	const workspace = config.workspaces.find((item) => resolve(registryRoot, item.root) === target);
	if (!workspace) {
		const path = relative(registryRoot, target).split(sep).join('/') || '.';
		return fail(`Workspace ${path} is not declared in harness.units.json`);
	}
	return { registryRoot, ...workspace, build: screenshotBuild(registryRoot, workspace, config) };
}

function screenshotBuild(
	registryRoot: string,
	workspace: UnitsConfig['workspaces'][number],
	config: UnitsConfig
): string {
	const file = join(registryRoot, verifyConfigFile);
	const builds = existsSync(file)
		? verifyConfigSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).builds
		: [];
	const candidates = builds.filter(
		(build) =>
			classifyPath(`${build.directory.replace(/\/$/, '')}/harness-build.ts`, config)
				.workspaceRoot === workspace.root
	);
	const named = candidates.filter((build) => workspace.name && build.id === workspace.name);
	const conventional = candidates.filter(
		(build) =>
			build.directory.replace(/\/$/, '') ===
			(workspace.root === '.' ? 'build' : `${workspace.root}/build`)
	);
	const preferred = named.length === 1 ? named : conventional;
	const selected = preferred.length === 1 ? preferred : candidates;
	if (selected.length === 1) return selected[0].id;
	const prefix = selected.length ? 'Multiple screenshot builds' : 'No declared screenshot build';
	return fail(`${prefix} for workspace ${workspace.root}`);
}

export type { VisualWorkspace } from './visualWorkspace.types';
