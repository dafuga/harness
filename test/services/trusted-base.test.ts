import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { VerificationRecord } from '../../src/core/verificationTypes';
import { VerificationStoreRepository } from '../../src/repositories/VerificationStoreRepository';
import { TrustedBaseService } from '../../src/services/TrustedBaseService';
import { sealRecord } from '../../src/utils/sealRecord';
import { runCommand } from '../support/cli';
import { measureProcess } from '../support/cli-measurement/measureProcess';
import { verificationSample } from '../support/verificationSample';

let root: string;
const commits: string[] = [];
const git = async (args: string[]) =>
	(await runCommand(['git', '-c', 'commit.gpgsign=false', ...args], root)).stdout.trim();

/** Stores a record for one commit; `edit` may tamper with it after it was sealed. */
async function store(
	commit: string,
	status: 'passed' | 'failed',
	startedAt: string,
	edit: (text: string) => string = (text) => text
): Promise<void> {
	const sample: Partial<VerificationRecord> = verificationSample();
	delete sample.id;
	const record = sealRecord({
		...(sample as Omit<VerificationRecord, 'id'>),
		source: { commit, tree: await git(['rev-parse', `${commit}^{tree}`]), base: null },
		startedAt,
		status,
		failures: status === 'passed' ? [] : ['a check failed'],
		components: [],
		measurements: []
	});
	const directory = join(
		root,
		'.cache/harness/verifications',
		commit,
		startedAt.replace(/\D/g, '')
	);
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, 'record.json'), edit(JSON.stringify(record)));
}

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-trusted-'));
	await git(['init', '-q', '-b', 'main']);
	for (const name of ['one', 'two', 'three', 'four']) {
		await writeFile(join(root, 'file.txt'), name);
		await git(['add', '-A']);
		const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@harness.invalid'];
		await git([...identity, 'commit', '-q', '-m', `feat: ${name}`]);
		commits.push(await git(['rev-parse', 'HEAD']));
	}
}, 60_000);
afterAll(() => rm(root, { recursive: true, force: true }));

test('TrustedBaseService finds the nearest revision a passing record proves', async () => {
	const service = new TrustedBaseService(root);
	const [one, two, three, four] = commits;
	expect(await service.nearest(four)).toBeNull();
	expect(await service.nearest(null)).toBeNull();

	await store(one, 'passed', '2026-10-10T00:00:01.000Z');
	expect(await service.nearest(four)).toBe(one);
	expect(await service.nearest(one)).toBe(one);

	await store(three, 'failed', '2026-10-10T00:00:02.000Z');
	expect(await service.nearest(four)).toBe(one);
	await store(two, 'passed', '2026-10-10T00:00:03.000Z');
	expect(await service.nearest(four)).toBe(two);
	expect(await service.nearest(one)).toBe(one);
}, 60_000);

test('a later failure, a forged outcome and a record for another tree are not trusted', async () => {
	const service = new TrustedBaseService(root);
	const [one, two, three, four] = commits;
	await store(two, 'failed', '2026-10-10T00:00:04.000Z');
	expect(await service.nearest(four)).toBe(one);

	const forge = (text: string) =>
		text.replace('"status":"failed"', '"status":"passed"').replace('"a check failed"', '');
	await store(three, 'failed', '2026-10-10T00:00:05.000Z', forge);
	expect(await service.nearest(four)).toBe(one);

	const elsewhere = (text: string) => text.replace(/"tree":"[0-9a-f]{40}"/, `"tree":"${one}"`);
	await store(four, 'passed', '2026-10-10T00:00:06.000Z', elsewhere);
	expect(await service.nearest(four)).toBe(one);
}, 60_000);

test('a large history keeps ancestry checks bounded and still rejects damaged lineage', async () => {
	const [one, , , four] = commits;
	const store = new VerificationStoreRepository(root);
	const parent = store.latest(one)!;
	const sample: Partial<VerificationRecord> = verificationSample();
	delete sample.id;
	const child = sealRecord({
		...(sample as Omit<VerificationRecord, 'id'>),
		source: {
			commit: four,
			tree: await git(['rev-parse', `${four}^{tree}`]),
			base: one,
			baseRecord: parent.record.id
		},
		startedAt: '2026-10-10T00:00:07.000Z',
		components: [],
		measurements: []
	});
	await store.save(child, store.directoryFor(four, child.startedAt));
	const extra = await largeHistory(store);
	try {
		const baseline = await historyMemory('all', four);
		const verified = await historyMemory('trusted', four);
		expect(verified.found).toEqual({ commit: four, record: child.id });
		console.log(`History RSS: trusted ${verified.rss}; one full read ${baseline.rss}`);
		expect(verified.rss).toBeLessThan(baseline.rss * 1.5);
	} finally {
		await Promise.all(extra.map((directory) => rm(directory, { recursive: true, force: true })));
	}
	const parentFile = join(parent.directory, 'record.json');
	const original = await readFile(parentFile, 'utf8');
	try {
		const damaged = { ...JSON.parse(original), status: 'failed' };
		await writeFile(parentFile, JSON.stringify(damaged));
		expect(await new TrustedBaseService(root).nearest(four)).toBeNull();
	} finally {
		await writeFile(parentFile, original);
	}
}, 120_000);

async function largeHistory(store: VerificationStoreRepository): Promise<string[]> {
	const sample: Partial<VerificationRecord> = verificationSample();
	delete sample.id;
	const draft = sample as Omit<VerificationRecord, 'id'>;
	const components = Array.from({ length: 6500 }, (_, index) => ({
		...draft.components[0],
		unit: `function.history-${index}`,
		files: [{ path: `src/history/${index}.ts`, hash: 'a'.repeat(40) }]
	}));
	const directories: string[] = [];
	for (let index = 1; index <= 46; index++) {
		const commit = index.toString(16).padStart(40, '0');
		const startedAt = new Date(Date.UTC(2026, 8, 1, 0, 0, index)).toISOString();
		const record = sealRecord({
			...draft,
			source: { commit, tree: 'd'.repeat(40), base: null },
			startedAt,
			status: 'failed',
			failures: ['a check failed'],
			components,
			measurements: []
		});
		const directory = store.directoryFor(commit, startedAt);
		await store.save(record, directory);
		directories.push(join(root, '.cache/harness/verifications', commit));
	}
	return directories;
}

async function historyMemory(kind: 'all' | 'trusted', commit: string) {
	const source =
		kind === 'all'
			? resolve('src/repositories/verification-evidence/VerificationStoreRepository.ts')
			: resolve('src/workflows/verification-evidence/run-verify/TrustedBaseService.ts');
	const operation =
		kind === 'all'
			? 'new api.VerificationStoreRepository(root).all()'
			: 'await new api.TrustedBaseService(root).nearestRecord(commit)';
	const program = `const api = await import(${JSON.stringify(source)});
const [root, commit] = process.argv.slice(1);
const found = ${operation};
console.log(JSON.stringify({ found: Array.isArray(found) ? found.length : found, rss: process.memoryUsage().rss }));`;
	const result = await measureProcess(
		{
			units:
				kind === 'all'
					? ['repository.verification-store']
					: ['repository.verification-store', 'service.trusted-base', 'service.verification-check'],
			workload: kind === 'all' ? 'read-large-history' : 'trusted-large-history',
			target: 'module',
			command: ['bun', '--eval', program, root, commit],
			cwd: process.cwd()
		},
		runCommand
	);
	return JSON.parse(result.stdout) as { found: unknown; rss: number };
}
