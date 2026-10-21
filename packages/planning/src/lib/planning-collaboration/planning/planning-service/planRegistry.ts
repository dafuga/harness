import { planningIgnores } from '../../../../utils/planning-collaboration/planRegistry';
import { Buffer } from 'node:buffer';
import { unitsConfigSchema } from '../../../../../../../src/lib/contracts';
import type { Git } from '../../../../utils/planning-collaboration/planGit';
import { blob, paths, safePath } from '../../../../utils/planning-collaboration/planGit';
import { fail, json } from '../../../../utils/planning-collaboration/planData';
import { assertClean, type Files } from '../../../../utils/planning-collaboration/plan-write/clean';

/** Exact immutable artifact names only; neighboring implementation remains formatted. */
const formatterIgnores = [
	'pages',
	'shells',
	'components',
	'functions',
	'services',
	'configs'
].flatMap((category) =>
	[
		'plan.json',
		'designs/v*/design.json',
		'designs/v*/prompt.md',
		'designs/v*/notes.md',
		'designs/approvals/*.json',
		'threads/*/thread.json'
	].map((name) => `**/src/${category}/*/${name}`)
);

async function formatterConfig(git: Git, revision: string): Promise<Files> {
	const path = '.prettierignore';
	await safePath(git, path);
	await assertClean(git, [path]);
	if (!(await paths(git, revision, path)).includes(path)) return {};
	const original = (await blob(git, revision, path)).toString();
	const existing = new Set(original.split(/\r?\n/).map((line) => line.trim()));
	const missing = formatterIgnores.filter((pattern) => !existing.has(pattern));
	if (!missing.length) return {};
	const separator = original.length && !original.endsWith('\n') ? '\n' : '';
	return { [path]: Buffer.from(`${original}${separator}${missing.join('\n')}\n`) };
}

/** Extend only an existing clean, valid registry configuration in the same artifact commit. */
export async function planRegistry(git: Git, revision: string): Promise<Files> {
	const formatter = await formatterConfig(git, revision);
	const path = 'harness.units.json';
	await safePath(git, path);
	await assertClean(git, [path]);
	if (!(await paths(git, revision, path)).includes(path)) return formatter;
	let value: unknown;
	try {
		value = JSON.parse((await blob(git, revision, path)).toString());
	} catch {
		return fail('invalid-input', 'Existing harness.units.json is not valid JSON');
	}
	const parsed = unitsConfigSchema.safeParse(value);
	if (!parsed.success) return fail('invalid-input', 'Existing harness.units.json is invalid');
	const ignored = [...new Set([...parsed.data.ignored, ...planningIgnores])];
	if (ignored.length === parsed.data.ignored.length) return formatter;
	return { ...formatter, [path]: json({ ...parsed.data, ignored }) };
}
