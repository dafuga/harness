import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlannedFile } from '../../core/development-tooling/files';
/** Package resources declare a pinned dependency without executing a package manager. */
export class ModulePackageService {
	async plan(root: string, name: string): Promise<PlannedFile> {
		const match =
			/^((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)@(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?)$/.exec(
				name
			);
		if (!match) throw new Error('Use a registry package with an exact version: package@1.2.3.');
		const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
		const existing = manifest.dependencies?.[match[1]] ?? manifest.devDependencies?.[match[1]];
		if (existing && existing !== match[2])
			throw new Error('Resolve the existing dependency before generation.');
		manifest.dependencies = { ...manifest.dependencies, [match[1]]: match[2] };
		return { path: 'package.json', contents: JSON.stringify(manifest, null, '\t') + '\n' };
	}
}
