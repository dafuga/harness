import type { Selection } from './generationGroup.types';
import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { ModuleCategoryService } from '../../../services/development-tooling/ModuleCategoryService';
import {
	moduleGroupConfig,
	moduleGroupsFile
} from '../../../configs/development-tooling/moduleGroupsConfig';
import { matchingGroups } from '../../../utils/development-tooling/moduleGroup';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import { fail } from '../../../core/development-tooling/errors';
import type { FileWriteResult } from '../../../core/development-tooling/files';

/** Legacy projects retain old entries until category adoption; categorized projects require a clear choice. */
export function generationGroup(
	root: string,
	input: { name: string; group?: string; responsibility?: string }
): Selection | undefined {
	const loaded = new ModuleCategoryService().load(root);
	if (input.group !== undefined) {
		const group = moduleGroupConfig.safeParse({
			id: input.group,
			title: groupTitle(input.group),
			terms: []
		});
		if (!group.success)
			return fail(
				'Use a lowercase kebab-case category with --group; paths are not category names.'
			);
		const known = loaded?.config.groups.find((item) => item.id === group.data.id);
		return { root: loaded?.root ?? root, group: known ?? group.data, add: !known };
	}
	if (!loaded) return undefined;
	const matches = matchingGroups(
		input.name + ' ' + (input.responsibility ?? ''),
		loaded.config.groups
	);
	if (matches.length !== 1)
		return fail(
			'Choose the module responsibility with --group <category>; its category is missing or ambiguous.'
		);
	return { root: loaded.root, group: matches[0], add: false };
}

/** Add only an explicitly selected new responsibility, retaining all existing project categories. */
export async function saveGenerationGroup(
	root: string,
	selection?: Selection
): Promise<FileWriteResult[]> {
	if (!selection?.add) return [];
	const loaded = new ModuleCategoryService().load(selection.root);
	const config = loaded?.config ?? { schemaVersion: 1 as const, groups: [], legacy: [] };
	if (config.groups.some((group) => group.id === selection.group.id)) return [];
	const contents = stableJson({ ...config, groups: [...config.groups, selection.group] });
	await writeFile(join(selection.root, moduleGroupsFile), contents);
	return [
		{
			path: relative(root, join(selection.root, moduleGroupsFile)),
			contents,
			status: loaded ? 'overwritten' : 'created'
		}
	];
}

function groupTitle(id: string): string {
	const text = id.replace(/-/g, ' ');
	return text.charAt(0).toUpperCase() + text.slice(1);
}
