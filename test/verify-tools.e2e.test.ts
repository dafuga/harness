import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 240_000);
afterAll(() => baseline.dispose());

/** A copy of the fixture whose verification declares the tools its checks depend on. */
async function declaring(tools: Array<{ id: string; command: string }>): Promise<VerifyRepo> {
	const repo = await cloneRepo(baseline);
	const config = await repo.json<Record<string, unknown>>('harness.verify.json');
	await repo.write('harness.verify.json', JSON.stringify({ ...config, tools }));
	await repo.commit('chore: record the tools verification depends on');
	return repo;
}

test('a record names the verifier, the runtime and every declared tool as it answered in the snapshot', async () => {
	const repo = await declaring([
		{ id: 'node', command: 'node --version' },
		{ id: 'fixture-tool', command: 'echo "fixture-tool 1.2.3"; echo "second line"' }
	]);
	const outcome = await repo.verify();
	expect([outcome.record.status, outcome.record.failures]).toEqual(['passed', []]);
	const sdk = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
	expect(outcome.record.tools).toEqual([
		{ id: 'harness', version: sdk.version },
		{ id: 'node', version: expect.stringMatching(/^v\d+\.\d+\.\d+$/) },
		{ id: 'fixture-tool', version: 'fixture-tool 1.2.3' }
	]);
	// It is part of the sealed record: changing it afterwards is refused like any other edit.
	const check = JSON.parse((await repo.run(['verify', 'check', '--json'])).stdout) as {
		status: string;
	};
	expect(check.status).toBe('passed');
	await repo.dispose();
}, 240_000);

test('a declared tool that cannot say what it is fails the verification before any check runs', async () => {
	const repo = await declaring([
		{ id: 'absent', command: 'harness-tool-that-does-not-exist --version' },
		{ id: 'silent', command: 'true' }
	]);
	const outcome = await repo.verify();
	expect(outcome.record.status).toBe('failed');
	expect(outcome.record.gates?.snapshot).toBe('failed');
	expect(outcome.record.failures).toEqual(
		expect.arrayContaining([
			'tool absent did not report a version: harness-tool-that-does-not-exist --version',
			'tool silent did not report a version: true'
		])
	);
	expect(outcome.record.tests).toEqual([]);
	expect(outcome.record.tools).toEqual([{ id: 'harness', version: expect.any(String) }]);
	await repo.dispose();
}, 240_000);
