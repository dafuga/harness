import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { fixtureSources } from './support/verifyFixture';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

const gained = (path: string) => `snapshot gained an undeclared file during verification: ${path}`;
const mutated = (path: string) => `snapshot mutated during verification: ${path}`;

/** Changes and explains a shared function, then verifies with a misbehaving check. */
async function verifyWith(
	env: Record<string, string>,
	prepare?: (repo: VerifyRepo) => Promise<void>
) {
	const repo = await cloneRepo(baseline);
	await prepare?.(repo);
	await repo.change('src/utils/slugify.ts', (source) =>
		source.replace('toLowerCase', 'toUpperCase')
	);
	const outcome = await repo.verify([], env);
	return { repo, ...outcome };
}

async function declareOutputs(repo: VerifyRepo, outputs: string[]): Promise<void> {
	const config = JSON.parse(fixtureSources['harness.verify.json']) as object;
	await repo.write('harness.verify.json', JSON.stringify({ ...config, outputs }));
	await repo.commit('chore: declare generated outputs');
}

test('a check that adds a new source file fails the snapshot gate and keeps its record', async () => {
	const path = 'src/utils/untracked-generated.ts';
	const { repo, exitCode, record, directory } = await verifyWith({ FIXTURE_MUTATE: path });
	expect([exitCode, record.status]).toEqual([1, 'failed']);
	expect(record.failures).toEqual([gained(path)]);
	expect(record.gates).toMatchObject({ snapshot: 'failed', tests: 'passed', scenarios: 'passed' });
	expect(existsSync(join(directory, 'record.json'))).toBe(true);
	expect(existsSync(join(repo.root, path))).toBe(false);
	await repo.dispose();

	for (const elsewhere of [
		'vitest.config.ts',
		'generated/helper.ts',
		'test/services/extra.test.ts'
	]) {
		const other = await verifyWith({ FIXTURE_MUTATE: elsewhere });
		expect([other.exitCode, other.record.failures]).toEqual([1, [gained(elsewhere)]]);
		await other.repo.dispose();
	}
}, 300_000);

test('removing or renaming tracked source fails the snapshot gate', async () => {
	const removed = await verifyWith({ FIXTURE_REMOVE: 'src/utils/clock.ts' });
	expect([removed.exitCode, removed.record.failures]).toEqual([1, [mutated('src/utils/clock.ts')]]);
	expect(existsSync(join(removed.repo.root, 'src/utils/clock.ts'))).toBe(true);
	await removed.repo.dispose();

	const renamed = await verifyWith({ FIXTURE_RENAME: 'src/utils/clock.ts:src/utils/timepiece.ts' });
	expect(renamed.exitCode).toBe(1);
	expect(renamed.record.failures).toEqual([
		mutated('src/utils/clock.ts'),
		gained('src/utils/timepiece.ts')
	]);
	await renamed.repo.dispose();
}, 240_000);

test('a file that one check adds and a later check removes is still caught', async () => {
	const path = 'src/utils/transient.ts';
	const { repo, exitCode, record } = await verifyWith({
		FIXTURE_ADD_EARLY: path,
		FIXTURE_REMOVE: path
	});
	expect([exitCode, record.failures]).toEqual([1, [gained(path)]]);
	await repo.dispose();
}, 180_000);

test('a declared output may be written, and nothing else may be', async () => {
	const declared = (repo: VerifyRepo) => declareOutputs(repo, ['build/']);
	const built = await verifyWith({ FIXTURE_MUTATE: 'build/out.js' }, declared);
	expect([built.exitCode, built.record.failures]).toEqual([0, []]);
	expect(built.record.gates).toMatchObject({ snapshot: 'passed' });
	await built.repo.dispose();

	const beside = await verifyWith({ FIXTURE_MUTATE: 'builds/out.js' }, declared);
	expect([beside.exitCode, beside.record.failures]).toEqual([1, [gained('builds/out.js')]]);
	await beside.repo.dispose();
	const source = await verifyWith({ FIXTURE_MUTATE: 'src/utils/extra.ts' }, declared);
	expect([source.exitCode, source.record.failures]).toEqual([1, [gained('src/utils/extra.ts')]]);
	await source.repo.dispose();
}, 300_000);

test('an output declaration cannot cover tracked source', async () => {
	const broad = await verifyWith({ FIXTURE_MUTATE: 'src/utils/extra.ts' }, (repo) =>
		declareOutputs(repo, ['src/'])
	);
	expect([broad.exitCode, broad.record.status]).toEqual([1, 'failed']);
	expect(broad.record.failures).toContainEqual(
		expect.stringMatching(
			/^harness\.verify\.json declares output "src\/", which covers tracked files such as src\/\S+; outputs may only name generated paths$/
		)
	);
	expect(broad.record.gates).toMatchObject({ snapshot: 'failed' });
	expect(broad.record.tests).toEqual([]);
	await broad.repo.dispose();
}, 180_000);

test('snapshot checks can inventory the selected Git source without a live checkout', async () => {
	const probe = String.raw`
import { execFileSync } from 'node:child_process';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (process.argv[2] === 'page') {
	const objects = process.env.HARNESS_VERIFY_GIT_OBJECTS;
	const format = process.env.HARNESS_VERIFY_GIT_OBJECT_FORMAT;
	if (!objects || !format) throw Error('Selected source Git objects were not supplied');
	const metadata = '.cache/selected-source.git';
	mkdirSync(metadata, { recursive: true });
	git('init', '--bare', '--object-format=' + format, metadata);
	writeFileSync(metadata + '/objects/info/alternates', objects + '\n');
	const selected = (...args) => git('--git-dir=' + metadata, '--work-tree=' + process.cwd(), ...args);
	selected('update-ref', '--no-deref', 'HEAD', process.env.HARNESS_VERIFY_REVISION);
	selected('read-tree', 'HEAD');
	if (selected('rev-parse', 'HEAD^{tree}') !== process.env.HARNESS_VERIFY_TREE)
		throw Error('Selected source tree does not match');
	if (selected('show', 'HEAD:src/utils/slugify.ts') !== read('src/utils/slugify.ts').trim())
		throw Error('Snapshot source does not match the selected Git object');
	if (existsSync('.git')) throw Error('Snapshot gained checkout metadata');
}
`;
	const { repo, record } = await verifyWith({}, async (repo) => {
		await declareOutputs(repo, ['.cache/']);
		await repo.write('scripts/fixture.mjs', fixtureSources['scripts/fixture.mjs'] + probe);
	});
	expect(
		record.tests.find((check) => check.id === 'titles-page:page')?.status,
		'Snapshot checks require selected Git source without borrowing a checkout'
	).toBe('passed');
	expect(record.gates?.snapshot).toBe('passed');
	await repo.dispose();
}, 180_000);
