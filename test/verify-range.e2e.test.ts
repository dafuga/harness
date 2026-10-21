import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	baselineRepo,
	cloneRepo,
	reason,
	type VerifyOutcome,
	type VerifyRepo
} from './support/verifyRepo';
import { fixtureSources } from './support/verifyFixture';

let baseline: VerifyRepo;
let verified: string;
beforeAll(async () => {
	baseline = await baselineRepo();
	verified = await baseline.git(['rev-parse', 'HEAD']);
}, 120_000);
afterAll(() => baseline.dispose());

const grow = (source: string) =>
	source.replace(
		'\treturn input',
		"\tif (input.length > 99 || input.includes('?')) return input;\n\treturn input"
	);
const baselineBytes = Buffer.byteLength(fixtureSources['src/utils/slugify.ts']);
const grownBytes = Buffer.byteLength(grow(fixtureSources['src/utils/slugify.ts']));

const growth = [
	`function.slugify: source-bytes grew from ${baselineBytes} to ${grownBytes} without a recorded approval`,
	'function.slugify: complexity grew from 1 to 3 without a recorded approval'
];
/** A behaviour change of the same size and complexity, so only reasons and tests are at stake. */
const reorder = (source: string) =>
	source.replace(/input\.trim\(\)\.(to\w+Case)\(\)/, 'input.$1().trim()');
const emptyChild = (repo: VerifyRepo) =>
	repo.git(['commit', '-q', '--allow-empty', '-m', 'chore: empty follow-up']);
const ran = (outcome: VerifyOutcome) => outcome.record.tests.map((item) => item.target);

test('unapproved growth cannot pass through another base or an empty child', async () => {
	const repo = await cloneRepo(baseline);
	const grown = await repo.change('src/utils/slugify.ts', grow);
	const normal = await repo.verify();
	expect([normal.exitCode, normal.record.failures]).toEqual([1, growth]);
	expect(normal.record.source).toEqual({
		commit: grown,
		tree: expect.any(String),
		base: verified,
		baseRecord: expect.stringMatching(/^[0-9a-f]{64}$/)
	});

	for (const base of ['HEAD', grown]) {
		const narrowed = await repo.verify(['--base', base]);
		expect([narrowed.exitCode, narrowed.record.status]).toEqual([1, 'failed']);
		expect(narrowed.record.failures).toEqual(growth);
		expect(narrowed.record.source).toMatchObject({ base: verified, requestedBase: grown });
		expect(narrowed.record.components.map((item) => item.unit)).toContain('function.slugify');
	}

	await emptyChild(repo);
	const child = await repo.verify();
	expect([child.exitCode, child.record.failures]).toEqual([1, growth]);
	expect(child.record.source).toMatchObject({ base: verified, requestedBase: grown });
	const explicit = await repo.verify(['--base', 'HEAD~1']);
	expect([explicit.exitCode, explicit.record.failures]).toEqual([1, growth]);
	await repo.dispose();
}, 240_000);

test('a missing reason and a failed test cannot pass through an empty child', async () => {
	const repo = await cloneRepo(baseline);
	const source = await repo.read('src/utils/slugify.ts');
	await repo.write('src/utils/slugify.ts', source.replace('toLowerCase', 'toUpperCase'));
	await repo.commit('feat: unexplained change');
	const unexplained = [
		'function.slugify: slugify in src/utils/slugify.ts was modified without a reason'
	];
	expect((await repo.verify()).record.failures).toEqual(unexplained);
	await emptyChild(repo);
	const child = await repo.verify();
	expect([child.exitCode, child.record.failures]).toEqual([1, unexplained]);
	expect((await repo.verify(['--base', 'HEAD'])).record.failures).toEqual(unexplained);
	await repo.dispose();

	const failing = await cloneRepo(baseline);
	await failing.change('src/utils/slugify.ts', reorder);
	const broken = await failing.verify([], { FIXTURE_FAIL: '1' });
	expect(broken.exitCode).toBe(1);
	const failed = broken.record.failures;
	expect(failed).toContainEqual(expect.stringMatching(/failed with exit code 1$/));
	await emptyChild(failing);
	const still = await failing.verify([], { FIXTURE_FAIL: '1' });
	expect([still.exitCode, still.record.failures]).toEqual([1, failed]);
	expect(ran(still)).toEqual(ran(broken));

	const repaired = await failing.verify();
	expect([repaired.exitCode, repaired.record.failures]).toEqual([0, []]);
	expect(ran(repaired)).toEqual(ran(broken));
	const head = await failing.git(['rev-parse', 'HEAD']);
	const page = repaired.record.scenarios.find((scenario) => scenario.id === 'titles-page');
	expect(page).toMatchObject({ status: 'passed', testedRevision: head });
	await failing.dispose();
}, 300_000);

test('an unverified parent is covered when its child is verified', async () => {
	const repo = await cloneRepo(baseline);
	await repo.change('src/utils/slugify.ts', grow);
	const head = await repo.change('src/services/TitleService.ts', (source) =>
		source.replace('titleCost = 10.0', 'titleCost = 10.1')
	);
	const outcome = await repo.verify();
	expect([outcome.exitCode, outcome.record.failures]).toEqual([1, growth]);
	expect(outcome.record.source).toMatchObject({ commit: head, base: verified });
	expect(outcome.record.impact.units.direct).toEqual(['function.slugify', 'service.title']);
	await repo.dispose();
}, 180_000);

test('nothing changed since a passing record: evidence is inherited and nothing reruns', async () => {
	const repo = await cloneRepo(baseline);
	const same = await repo.verify(['--base', 'HEAD']);
	expect([same.exitCode, same.record.failures, ran(same)]).toEqual([0, [], []]);
	await emptyChild(repo);
	const child = await repo.verify();
	expect([child.exitCode, child.record.failures, ran(child)]).toEqual([0, [], []]);
	expect(child.record.source).toEqual({
		commit: await repo.git(['rev-parse', 'HEAD']),
		tree: expect.any(String),
		base: verified,
		baseRecord: same.record.id
	});
	expect(child.record.scenarios.map((scenario) => scenario.status)).toEqual(
		child.record.scenarios.map(() => 'referenced')
	);
	expect(child.record.scenarios.length).toBeGreaterThan(0);
	await repo.dispose();
}, 180_000);

test('changes explained commit by commit are accepted when only the last commit is verified', async () => {
	const repo = await cloneRepo(baseline);
	await repo.change('src/utils/slugify.ts', (text) => text.replace('toLowerCase', 'toUpperCase'));
	await repo.change('src/utils/slugify.ts', reorder);
	await repo.write(
		'src/utils/slugify.ts',
		(await repo.read('src/utils/slugify.ts')).replace('toUpperCase', 'toLowerCase')
	);
	await repo.commit('feat: a third change without a reason');
	const broken = await repo.verify();
	expect(broken.record.source.base).toBe(verified);
	expect(broken.record.failures).toEqual([
		'function.slugify: slugify in src/utils/slugify.ts was modified after its reason was written'
	]);

	const last = ['--unit', 'function.slugify', '--base', 'HEAD~1', '--head', 'HEAD'];
	await repo.harness(['explain', 'add', ...last, ...reason]);
	const outcome = await repo.verify();
	expect([outcome.exitCode, outcome.record.failures]).toEqual([0, []]);
	expect(outcome.record.source.base).toBe(verified);
	expect(outcome.record.reasons.entries?.map((entry) => entry.symbol)).toEqual([
		'slugify',
		'slugify',
		'slugify'
	]);
	await repo.dispose();
}, 240_000);
