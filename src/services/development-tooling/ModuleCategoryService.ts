import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
	moduleGroupsConfig,
	moduleGroupsFile,
	type ModuleGroupsConfig
} from '../../configs/development-tooling/moduleGroupsConfig';
import { fail } from '../../core/development-tooling/errors';
import type { SourceTree } from '../../core/development-tooling/sourceTypes';

/** Reads one taxonomy at the project boundary, or from the selected immutable source tree. */
export class ModuleCategoryService {
	load(directory: string): { root: string; config: ModuleGroupsConfig } | undefined {
		let root = resolve(directory);
		for (;;) {
			const file = join(root, moduleGroupsFile);
			if (existsSync(file)) return { root, config: parseGroups(readFileSync(file, 'utf8')) };
			const parent = dirname(root);
			if (parent === root || existsSync(join(root, '.git'))) return undefined;
			root = parent;
		}
	}

	async at(tree: Pick<SourceTree, 'read'>): Promise<ModuleGroupsConfig | undefined> {
		let source: string;
		try {
			source = await tree.read(moduleGroupsFile);
		} catch {
			return undefined;
		}
		return typeof source === 'string' ? parseGroups(source) : undefined;
	}
}

function parseGroups(source: string): ModuleGroupsConfig {
	try {
		return moduleGroupsConfig.parse(JSON.parse(source));
	} catch {
		return fail(
			'harness.groups.json must contain unique kebab-case category ids, titles and terms.'
		);
	}
}
