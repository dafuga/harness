import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { baselineRepo, type VerifyRepo } from './support/verifyRepo';

interface Impact {
	expanded: boolean;
	units: Record<'direct' | 'indirect' | 'added' | 'removed', string[]>;
	scenarios: { affected: string[] };
	uncertain: Array<{ node: string; reason: string }>;
	changed: Array<{ path: string; status: string }>;
}
interface Detail {
	comparison: unknown;
	records: unknown[];
	sourceImpact: {
		base: string | null;
		expanded: boolean;
		units: Impact['units'];
		scenarios: string[];
		uncertain: Impact['uncertain'];
		changed: Impact['changed'];
	} | null;
}

let repo: VerifyRepo;
let out: string;
const commits: Record<string, { commit: string; parent: string }> = {};
const title = 'src/services/TitleService.ts';

/** Commits a source edit exactly as written: no re-index, no reason, no verification. */
async function sourceOnly(name: string, edit: () => Promise<unknown>): Promise<void> {
	const parent = await repo.git(['rev-parse', 'HEAD']);
	await edit();
	commits[name] = { commit: await repo.commit(`feat: ${name}`), parent };
}
const detail = async (name: string) =>
	JSON.parse(
		await readFile(join(out, 'revisions', `${commits[name].commit}.json`), 'utf8')
	) as Detail;
const authoritative = async (name: string) => {
	const { commit, parent } = commits[name];
	const result = await repo.run(['impact', '--base', parent, '--head', commit, '--json']);
	return JSON.parse(result.stdout) as Impact;
};

// A history with no record and no note at all: nothing but source commits.
beforeAll(async () => {
	repo = await baselineRepo();
	const edit = async (path: string, change: (source: string) => string) =>
		repo.write(path, change(await repo.read(path)));
	await sourceOnly('edited', () =>
		edit('src/utils/slugify.ts', (source) => source.replace('toLowerCase', 'toUpperCase'))
	);
	await sourceOnly('rewired', () =>
		edit(title, (source) =>
			source
				.replace(
					"import { slugify } from '../utils/slugify';",
					"import { clock } from '../utils/clock';"
				)
				.replace('slugify(title)', 'clock(title)')
		)
	);
	await sourceOnly('unresolved', () =>
		repo.write(
			'src/utils/loader.ts',
			'export function loader(name: string): Promise<unknown> {\n\treturn import(name);\n}\n'
		)
	);
	await sourceOnly('removed', () => repo.git(['rm', '-q', 'src/utils/loader.ts']));
	out = await mkdtemp(join(tmpdir(), 'harness-impact-index-'));
	await repo.harness(['history', 'build', '--out', out]);
}, 300_000);
afterAll(async () => {
	await repo.dispose();
	await rm(out, { recursive: true, force: true });
});

test('a source-only edit under identical manifests is a direct change, with no record needed', async () => {
	const { commit, parent } = commits.edited;
	const touched = await repo.git(['diff', '--name-only', parent, commit]);
	expect(touched).toBe('src/utils/slugify.ts');
	const built = await detail('edited');
	expect([built.records, built.comparison]).toEqual([[], null]);
	expect(built.sourceImpact?.base).toBe(parent);
	expect(built.sourceImpact?.units.direct).toEqual(['function.slugify']);
	expect(built.sourceImpact?.units.indirect).toEqual(
		expect.arrayContaining(['page.titles', 'service.title'])
	);
	expect(built.sourceImpact?.scenarios).toEqual(
		expect.arrayContaining(['titles-audio', 'titles-boundary', 'titles-page'])
	);
	expect(built.sourceImpact?.scenarios).not.toContain('clock');
});

test.each(['edited', 'rewired', 'unresolved', 'removed'])(
	'the index states the same impact for %s as the impact command on the same two commits',
	async (name) => {
		const [built, cli] = [await detail(name), await authoritative(name)];
		expect(built.sourceImpact).toEqual({
			base: commits[name].parent,
			expanded: cli.expanded,
			units: cli.units,
			scenarios: cli.scenarios.affected,
			uncertain: cli.uncertain,
			changed: cli.changed
		});
	}
);

test('a changed dependency, an unresolved reference and a removal are each visible', async () => {
	const rewired = await detail('rewired');
	expect(rewired.sourceImpact?.units.direct).toEqual(['service.title']);
	const unresolved = await detail('unresolved');
	expect(unresolved.sourceImpact?.units.added.length).toBe(1);
	expect(unresolved.sourceImpact?.uncertain.length).toBeGreaterThan(0);
	expect(unresolved.sourceImpact?.expanded).toBe(true);
	const removed = await detail('removed');
	expect(removed.sourceImpact?.units.removed).toEqual(unresolved.sourceImpact?.units.added);
	expect(removed.sourceImpact?.changed).toEqual([
		expect.objectContaining({ path: 'src/utils/loader.ts', status: 'removed' })
	]);
});
