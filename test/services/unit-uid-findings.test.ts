import { expect, test } from 'vitest';
import { indexFiles } from '../support/memoryTree';
import { uidFindings } from '../../src/validators/development-tooling/uidFindings';

const a = 'u_aaaaaaaaaa';
const b = 'u_bbbbbbbbbb';
const code = (uid?: string) => `${uid ? `// @harness-uid ${uid}\n` : ''}export const x = 1;\n`;

async function indexed(files: Record<string, string>, uids: Record<string, string | undefined>) {
	const first = await indexFiles(files);
	const manifests = first.result.manifests.map((unit) => ({
		...unit,
		...(uids[unit.id] ? { uid: uids[unit.id] } : {})
	}));
	return { files: first.index.files, manifests };
}

test('a unit without a uid, or a commentable file that does not announce it, is reported', async () => {
	const { files, manifests } = await indexed({ 'src/utils/one.ts': code() }, {});
	expect(uidFindings(manifests, files).map((found) => found.kind)).toEqual(['uid-missing']);
	const stamped = await indexed({ 'src/utils/one.ts': code() }, { 'function.one': a });
	expect(uidFindings(stamped.manifests, stamped.files)).toEqual([
		expect.objectContaining({ kind: 'uid-missing', where: 'src/utils/one.ts' })
	]);
});

test('a file announcing another uid is a mismatch, or a copy when another unit holds that uid', async () => {
	const d = 'u_dddddddddd';
	const sources = { 'src/utils/one.ts': code(d), 'src/utils/two.ts': code('u_eeeeeeeeee') };
	const free = await indexed(sources, { 'function.one': a, 'function.two': b });
	expect(
		uidFindings(free.manifests, free.files).map((found) => `${found.unit} ${found.kind}`)
	).toEqual(['function.one uid-mismatch', 'function.two uid-mismatch']);
	const copied = await indexed(sources, { 'function.one': a, 'function.two': d });
	expect(
		uidFindings(copied.manifests, copied.files).map((found) => `${found.unit} ${found.kind}`)
	).toEqual(['function.one uid-copied', 'function.two uid-mismatch']);
});

test('two units holding one uid are duplicates, and a matching unit has no findings', async () => {
	const sources = { 'src/utils/one.ts': code(), 'src/utils/two.ts': code() };
	const both = await indexed(sources, { 'function.one': a, 'function.two': a });
	const kinds = uidFindings(both.manifests, both.files).map((found) => found.kind);
	expect(kinds.filter((kind) => kind === 'uid-duplicate')).toHaveLength(2);
	const clean = await indexed({ 'src/utils/one.ts': code(a) }, { 'function.one': a });
	expect(uidFindings(clean.manifests, clean.files)).toEqual([]);
	const scoped = uidFindings(both.manifests, both.files, new Set(['function.one']));
	expect(new Set(scoped.map((found) => found.unit))).toEqual(new Set(['function.one']));
});

test('retired units and files that take no comment are not reviewed', async () => {
	const { files, manifests } = await indexed({ 'src/data/rows.json': '{}\n' }, {});
	const stamped = manifests.map((unit) => ({ ...unit, uid: a }));
	expect(uidFindings(stamped, files)).toEqual([]);
	const retired = manifests.map((unit) => ({ ...unit, status: 'retired' as const }));
	expect(uidFindings(retired, files)).toEqual([]);
});
