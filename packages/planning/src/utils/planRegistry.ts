import { unitsConfigSchema } from '../../../../src/lib/contracts';
import type { Git } from './planGit';
import { blob, paths, safePath } from './planGit';
import { fail, json } from './planData';
import { assertClean, type Files } from './planWrite';

/** Artifact folders are planning history, never active implementation units. */
export const planningIgnores = ['pages', 'components', 'functions', 'services', 'configs'].flatMap(
	(category) => [
		`**/src/${category}/*/plan.json`,
		`**/src/${category}/*/.gitattributes`,
		`**/src/${category}/*/designs/**/*`,
		`**/src/${category}/*/threads/**/*`
	]
);

/** Extend only an existing clean, valid registry configuration in the same artifact commit. */
export async function planRegistry(git: Git, revision: string): Promise<Files> {
	const path = 'harness.units.json';
	await safePath(git, path);
	await assertClean(git, [path]);
	if (!(await paths(git, revision, path)).includes(path)) return {};
	let value: unknown;
	try {
		value = JSON.parse((await blob(git, revision, path)).toString());
	} catch {
		return fail('invalid-input', 'Existing harness.units.json is not valid JSON');
	}
	const parsed = unitsConfigSchema.safeParse(value);
	if (!parsed.success) return fail('invalid-input', 'Existing harness.units.json is invalid');
	const ignored = [...new Set([...parsed.data.ignored, ...planningIgnores])];
	if (ignored.length === parsed.data.ignored.length) return {};
	return { [path]: json({ ...parsed.data, ignored }) };
}
