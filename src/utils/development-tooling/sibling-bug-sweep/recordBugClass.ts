// @harness-uid u_wwerrde2nk
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';
import {
	bugClassId,
	classRecordSchema
} from '../../../core/development-tooling/bug-class/bugClassSchemas';
import type { BugClass } from '../../../core/development-tooling/bug-class/bugClassSchemas.types';

const registry = 'specification/bug-classes';

export async function readBugClasses(tree: SourceTree) {
	const paths = (await tree.list())
		.map(({ path }) => path)
		.filter(
			(path) =>
				path.startsWith(registry + '/') &&
				/^[a-z0-9-]+\.json$/.test(path.slice(registry.length + 1))
		);
	return Promise.all(
		paths.map(async (path) => {
			const record = classRecordSchema.parse(JSON.parse(await tree.read(path)));
			if (path !== classPath(record.bugClass.id))
				throw new Error(`Bug class ID does not match ${path}.`);
			return record.bugClass;
		})
	);
}

export async function registeredBugClass(tree: SourceTree, id: string) {
	const path = classPath(bugClassId.parse(id));
	if (!(await tree.list()).some((entry) => entry.path === path))
		throw new Error(`Bug class "${id}" is missing at ${tree.revision}.`);
	const record = classRecordSchema.parse(JSON.parse(await tree.read(path)));
	if (record.bugClass.id !== id) throw new Error(`Bug class ID does not match ${path}.`);
	return record.bugClass;
}

export async function recordBugClass(root: string, bugClass: BugClass, revision: string) {
	const path = classPath(bugClass.id);
	const target = join(root, path);
	const data = { schemaVersion: 1, revision, bugClass };
	await mkdir(join(root, registry), { recursive: true });
	try {
		await writeFile(target, JSON.stringify(data, null, '\t') + '\n', { flag: 'wx' });
	} catch (error) {
		if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
		const existing = classRecordSchema.parse(JSON.parse(await readFile(target, 'utf8')));
		if (JSON.stringify(existing.bugClass) !== JSON.stringify(bugClass))
			throw new Error(
				`Bug class "${bugClass.id}" already has different criteria. Use its committed class or choose a distinct ID.`
			);
	}
	return path;
}

function classPath(id: string) {
	return `${registry}/${id}.json`;
}
