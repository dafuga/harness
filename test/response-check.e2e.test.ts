import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { runJevCli } from './support/jevCli';

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'harness-response-'));
	roots.push(root);
	await writeFile(join(root, 'request.txt'), 'Name two colors in a JSON array.');
	await writeFile(join(root, 'answer.txt'), '["red","blue"]');
	await writeFile(join(root, 'context.txt'), 'Prior discussion about colors.');
	await writeFile(
		join(root, 'criteria.json'),
		JSON.stringify([{ id: 'count', description: 'Exactly two colors.' }])
	);
	return root;
}
const args = ['response-check', '--request', 'request.txt', '--response', 'answer.txt', '--json'];

test('CLI reports all standard and custom judgments without raw input', async () => {
	const root = await fixture();
	const result = await runJevCli(root, [
		...args,
		'--context',
		'context.txt',
		'--criteria',
		'criteria.json',
		'--gate'
	]);
	expect(result.exitCode).toBe(0);
	const report = JSON.parse(result.stdout);
	expect(report.status).toBe('satisfied');
	expect(report.checks).toHaveLength(5);
	expect(report.checks.at(-1).id).toBe('custom:count');
	expect(report.usage.input_tokens).toBe(100);
	expect(result.stdout).not.toContain('Prior discussion');
	expect(result.stdout).not.toContain('synthetic-test-key');
});

test.each(['violates', 'uncertain'])(
	'gate rejects %s while advisory completes',
	async (scenario) => {
		const root = await fixture();
		const gate = await runJevCli(root, [...args, '--gate'], scenario);
		expect(gate.exitCode).toBe(1);
		expect(JSON.parse(gate.stdout).status).toBe(
			scenario === 'violates' ? 'violations' : 'needs-review'
		);
		expect((await runJevCli(root, args, scenario)).exitCode).toBe(0);
	}
);

test('dry run is offline and describes coverage', async () => {
	const result = await runJevCli(await fixture(), [...args, '--dry-run', '--gate'], 'offline-only');
	expect(result.exitCode).toBe(0);
	expect(JSON.parse(result.stdout).status).toBe('dry-run');
});

test('provider authentication failure is incomplete and sanitized', async () => {
	const result = await runJevCli(await fixture(), args, 'unauthorized');
	expect(result.exitCode).toBe(2);
	expect(JSON.parse(result.stdout).status).toBe('incomplete');
	expect(result.stdout + result.stderr).not.toContain('synthetic-test-key');
});

test('guide documents strict gating', async () => {
	const result = await runJevCli(
		await fixture(),
		['info', 'response-check', '--json'],
		'offline-only'
	);
	expect(result.exitCode).toBe(0);
	expect(JSON.parse(result.stdout).topic).toBe('response-check');
});

test.each([
	['missing request', ['--request', 'missing.txt']],
	['invalid threshold', ['--min-confidence', '0']],
	['invalid model', ['--model', 'other']],
	['missing credential', ['--api-key-env', 'HARNESS_RESPONSE_TEST_MISSING_KEY']]
])('CLI returns incomplete for %s', async (_name, extra) => {
	const result = await runJevCli(await fixture(), [...args, ...extra]);
	expect(result.exitCode).toBe(2);
	expect(JSON.parse(result.stdout).status).toBe('incomplete');
});

test.each(['', 'not JSON', '[{"id":"a","description":"x"},{"id":"a","description":"y"}]'])(
	'CLI rejects malformed criteria',
	async (text) => {
		const root = await fixture();
		await writeFile(join(root, 'criteria.json'), text);
		const result = await runJevCli(
			root,
			[...args, '--criteria', 'criteria.json', '--dry-run'],
			'offline-only'
		);
		expect(result.exitCode).toBe(2);
	}
);

test.each([' ', 'x'.repeat(24001), 'é'.repeat(12001)])(
	'CLI rejects empty or oversized request without an API call',
	async (text) => {
		const root = await fixture();
		await writeFile(join(root, 'request.txt'), text);
		const result = await runJevCli(root, args, 'offline-only');
		expect(result.exitCode).toBe(2);
		expect(JSON.parse(result.stdout).status).toBe('incomplete');
	}
);

test('combined serialized size is bounded and invalid UTF-8 is rejected', async () => {
	const root = await fixture();
	await writeFile(join(root, 'context.txt'), 'a'.repeat(23980));
	expect(
		(await runJevCli(root, [...args, '--context', 'context.txt'], 'offline-only')).exitCode
	).toBe(2);
	await writeFile(join(root, 'answer.txt'), Buffer.from([0xff]));
	expect((await runJevCli(root, args, 'offline-only')).exitCode).toBe(2);
});

test('empty answer has a deterministic failure in gate mode without an API call', async () => {
	const root = await fixture();
	await writeFile(join(root, 'answer.txt'), '');
	const result = await runJevCli(root, [...args, '--gate'], 'offline-only');
	expect(result.exitCode).toBe(1);
	expect(JSON.parse(result.stdout).status).toBe('violations');
});

test('existing command-based loops reject uncertain response checks', async () => {
	const root = await fixture();
	const command = `bun --preload "${join(process.cwd(), 'test/support/jevPreload.ts')}" "${join(process.cwd(), 'src/index.ts')}" response-check --request request.txt --response answer.txt --gate --json`;
	await writeFile(join(root, 'harness.loop.json'), JSON.stringify({ templates: [] }));
	const { mkdir } = await import('node:fs/promises');
	await mkdir(join(root, 'specification/loops/answer'), { recursive: true });
	await writeFile(
		join(root, 'specification/loops/answer/loop.json'),
		JSON.stringify({
			name: 'answer',
			goal: 'Answer follows request',
			steps: [],
			evaluators: [{ id: 'response', title: 'Response follows request', command }]
		})
	);
	const result = await runJevCli(root, ['loop', 'evaluate', 'answer', '--json'], 'uncertain');
	expect(result.exitCode).toBe(1);
	expect(JSON.parse(result.stdout).passed).toBe(false);
	expect(JSON.parse(result.stdout).results[0].exitCode).toBe(1);
});

test.each(['malformed', 'wrong-model'])(
	'provider %s response is incomplete and sanitized',
	async (scenario) => {
		const result = await runJevCli(await fixture(), args, scenario);
		expect(result.exitCode).toBe(2);
		expect(JSON.parse(result.stdout).status).toBe('incomplete');
		expect(result.stdout + result.stderr).not.toContain('synthetic-test-key');
	}
);
