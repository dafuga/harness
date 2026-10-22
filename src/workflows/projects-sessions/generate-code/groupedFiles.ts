import { existsSync, readdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fail } from '../../../core/development-tooling/errors';
import type { PlannedFile } from '../../../core/development-tooling/files';
import type { ExportPlan } from '../../../core/projects-sessions/exports';
import { modulePath } from '../../../utils/development-tooling/moduleGroup';
import { groupedImports, groupedSpecifier } from './groupedImports';

/** Apply one category to every source/test piece while retaining framework entry filenames. */
export function groupedFiles(files: PlannedFile[], group?: string) {
	const paths = new Map(
		files.map((file) => [file.path, group ? groupedPath(file.path, group) : file.path])
	);
	return {
		paths,
		files: files.map((file) => ({
			path: paths.get(file.path)!,
			contents: group
				? groupedImports(file.contents, file.path, paths.get(file.path)!, paths)
				: file.contents
		}))
	};
}

export function groupedExports(plans: ExportPlan[], paths: Map<string, string>): ExportPlan[] {
	return plans.map((plan) => ({
		...plan,
		source: groupedSpecifier(plan.source, 'src/index.ts', 'src/index.ts', paths)
	}));
}

function groupedPath(path: string, group: string): string {
	if (path.startsWith('src/models/adapters/')) return path;
	const source = modulePath(path);
	if (source) {
		const category = source.root.endsWith('/routes') ? '(' + group + ')' : group;
		return [source.root, category, ...source.parts].join('/');
	}
	const test = /^(test\/[^/]+|db\/(?:seed-data|migrations))\/(.+)$/.exec(path);
	return test && !path.startsWith('test/support/') ? test[1] + '/' + group + '/' + test[2] : path;
}

/** Refuse a second declaration of an existing module hidden inside an owner folder. */
export function assertUniqueGroupedNames(
	root: string,
	group: string | undefined,
	files: PlannedFile[]
): void {
	if (!group) return;
	for (const file of files) {
		const source = modulePath(file.path);
		if (source?.parts[0] !== group || !/\.(?:ts|svelte)$/.test(file.path)) continue;
		const directory = join(root, source.root, group);
		if (!existsSync(directory)) continue;
		const duplicate = readdirSync(directory, { recursive: true, withFileTypes: true }).find(
			(entry) =>
				entry.isFile() &&
				entry.name === basename(file.path) &&
				relative(root, join(entry.parentPath, entry.name)) !== file.path
		);
		if (duplicate)
			fail(
				`The module already exists at ${relative(root, join(duplicate.parentPath, duplicate.name))}; edit its existing owner instead of adding a duplicate.`
			);
	}
}
