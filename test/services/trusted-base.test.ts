import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { VerificationRecord } from '../../src/core/verificationTypes';
import { TrustedBaseService } from '../../src/services/TrustedBaseService';
import { sealRecord } from '../../src/utils/sealRecord';
import { runCommand } from '../support/cli';
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
