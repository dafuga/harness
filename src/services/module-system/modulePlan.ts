import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ModuleDefinition } from './moduleDefinition.types';
import type { PlannedFile } from '../../core/development-tooling/files';

/** Preserve existing project settings and require deliberate resolution of dependency conflicts. */
export async function modulePackagePlan(
	root: string,
	definition: ModuleDefinition
): Promise<PlannedFile> {
	const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
	if (definition.appOnly && !['app', 'game'].includes(manifest.harness?.kind))
		throw new Error('This module requires a Harness app project.');
	for (const field of ['dependencies', 'devDependencies'] as const) {
		if (Object.keys(definition[field] ?? {}).length)
			manifest[field] = moduleDependencies(manifest[field], definition[field]);
	}
	if (definition.packageScripts)
		manifest.scripts = moduleDependencies(manifest.scripts, definition.packageScripts);
	return { path: 'package.json', contents: JSON.stringify(manifest, null, '\t') + '\n' };
}

/** Module source folders participate in the same project-wide responsibility taxonomy. */
export async function moduleGroupPlan(
	root: string,
	definition: ModuleDefinition
): Promise<PlannedFile> {
	let config = {
		schemaVersion: 1,
		groups: [] as Array<{ id: string; title: string; terms: string[] }>,
		legacy: [] as string[]
	};
	try {
		config = JSON.parse(await readFile(join(root, 'harness.groups.json'), 'utf8'));
	} catch (error) {
		if ((error as { code?: string }).code !== 'ENOENT') throw error;
	}
	if (!config.groups.some((group) => group.id === definition.id))
		config.groups.push({ id: definition.id, title: definition.title, terms: [definition.id] });
	return { path: 'harness.groups.json', contents: JSON.stringify(config, null, '\t') + '\n' };
}

function moduleDependencies(
	existing: Record<string, string> = {},
	requested: Record<string, string> = {}
) {
	const dependencies = { ...existing };
	for (const [name, version] of Object.entries(requested)) {
		if (dependencies[name] && dependencies[name] !== version)
			throw new Error(`Resolve the existing dependency ${name} before installing this module.`);
		dependencies[name] = version;
	}
	return dependencies;
}
