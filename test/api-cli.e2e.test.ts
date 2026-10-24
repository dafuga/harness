import { expect } from './verificationExpect';
import { test } from 'vitest';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { apiFixture, commit, requestId, png } from './support/api-cli/apiFixture';

test('API CLI discovers resources and reads arbitrary hosted resources, queries and large JSON', async () => {
	const f = await apiFixture('hosted');
	try {
		const resources = await f.cli(['resources']);
		expect(JSON.parse(resources.stdout).resources).toEqual(
			expect.arrayContaining(['entities', 'contracts', 'evidence', 'agents'])
		);
		const result = await f.cli(['get', '/api/future', '--query', 'tag=one', '--query', 'tag=two']);
		expect(JSON.parse(result.stdout)).toEqual({ tags: ['one', 'two'], text: 'x'.repeat(70000) });
		expect(result.stdout.endsWith('\n')).toBe(true);
		expect(f.seen.at(-1)?.authorization).toBe('Bearer synthetic-hosted-secret');
		expect(f.seen.at(-1)?.url).not.toContain('secret');
	} finally {
		await f.close();
	}
});

test.each(['local', 'hosted'] as const)(
	'API CLI reads %s contracts at the selected revision',
	async (mode) => {
		const f = await apiFixture(mode);
		try {
			const result = await f.cli([
				'contracts',
				'get',
				'page.example',
				'--branch',
				'feat/api',
				'--commit',
				commit
			]);
			expect(JSON.parse(result.stdout)).toEqual({
				summary: 'A real contract',
				inputs: [],
				outputs: [],
				errors: []
			});
			expect(JSON.parse((await f.cli(['get', 'entities', '--select', '0.id'])).stdout)).toBe(
				'page.example'
			);
			expect(f.seen.find((r) => r.operation === 'entity')?.input).toMatchObject({
				entityId: 'page.example',
				commit
			});
			expect(result.stdout).not.toContain('secret');
		} finally {
			await f.close();
		}
	}
);

test.each(['local', 'hosted'] as const)(
	'API CLI defines a %s contract and preserves explicit agent identity',
	async (mode) => {
		const f = await apiFixture(mode);
		try {
			const plan = {
				category: 'functions',
				title: 'Format totals',
				goal: 'Format a total',
				contract: { inputs: [], outputs: [], errors: [] }
			};
			const file = join(f.directory, 'plan.json');
			await writeFile(file, JSON.stringify(plan));
			await f.cli(['contracts', 'define', '--input', '@' + file]);
			expect(f.seen.find((r) => r.operation === 'createPlan')?.input).toMatchObject(plan);
			const run = {
				mode: 'plan',
				provider: 'codex',
				model: 'explicit-model',
				effort: 'high',
				entityId: 'page.example',
				threadId: 'thread-1',
				text: 'Plan the change',
				approval: null
			};
			const started = await f.cli([
				'agents',
				'start',
				'--input',
				JSON.stringify(run),
				'--request-id',
				requestId
			]);
			expect(JSON.parse(started.stdout)).toMatchObject({ runId: 'run-1', requestId });
			expect(f.seen.find((r) => r.operation === 'startRun')?.body).toMatchObject({
				input: run,
				requestId
			});
			if (mode === 'hosted')
				expect(f.seen.find((r) => r.operation === 'startRun')?.body).toMatchObject({
					revision: { branch: 'feat/api', commit }
				});
			const events = await f.cli(['agents', 'events', 'run-1', '--after', '3']);
			expect(JSON.parse(events.stdout).events[0]).toMatchObject({
				sequence: 4,
				value: { runId: 'run-1', kind: 'finished' }
			});
			await f.cli(['agents', 'cancel', 'run-1']);
			expect(f.seen.find((r) => r.operation === 'cancelRun')?.input).toMatchObject({
				runId: 'run-1'
			});
		} finally {
			await f.close();
		}
	}
);

test.each(['local', 'hosted'] as const)(
	'API CLI downloads verified %s screenshots and retains provenance',
	async (mode) => {
		const f = await apiFixture(mode);
		try {
			const output = join(f.directory, 'page.png');
			const result = await f.cli([
				'screenshot',
				'page.example',
				'--viewport',
				'desktop',
				'--state',
				'ready',
				'--output',
				output
			]);
			expect(await readFile(output)).toEqual(png);
			expect(JSON.parse(result.stdout)).toMatchObject({
				path: output,
				entityId: 'page.example',
				commit,
				viewport: 'desktop',
				state: 'ready',
				mediaType: 'image/png'
			});
			expect(f.seen.find((r) => r.operation === 'artifact')?.input).toMatchObject({
				entityId: 'page.example',
				commit,
				scenarioId: 'page-screens',
				recordId: 'b'.repeat(64),
				evidenceId: 'screen',
				notesRevision: null,
				evidenceRevision: null
			});
			f.corrupt();
			const failed = await f.cli(
				['screenshot', 'page.example', '--output', join(f.directory, 'corrupt.png')],
				false
			);
			expect(failed.exitCode).toBe(1);
			expect(failed.stderr).toMatch(/hash|SHA-256|integrity/i);
		} finally {
			await f.close();
		}
	}
);

test('API CLI reuses private local sessions across invocations without exposing credentials', async () => {
	const f = await apiFixture('local');
	try {
		await f.cli(['get', 'snapshot']);
		await f.cli(['agents', 'providers']);
		expect(f.seen.filter((r) => r.operation === 'connect')).toHaveLength(1);
		expect(f.seen.find((r) => r.operation === 'providers')?.authorization).toBe(
			'Bearer synthetic-local-secret'
		);
		const session = f.sessionFiles();
		expect(session).toHaveLength(1);
		expect((await stat(session[0])).mode & 0o777).toBe(0o600);
	} finally {
		await f.close();
	}
});

test('API CLI refuses redirects, off-origin paths and insecure remote URLs', async () => {
	const f = await apiFixture('hosted');
	try {
		for (const path of [
			'https://other.invalid/api/projects',
			'//other.invalid/api/projects',
			'/api/redirect'
		]) {
			const result = await f.cli(['get', path], false);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).not.toContain('synthetic-hosted-secret');
		}
		const insecure = await f.cli(['--url', 'http://example.com', 'get', '/api/projects'], false);
		expect(insecure.exitCode).toBe(1);
		expect(insecure.stderr).toMatch(/HTTPS/i);
		expect(f.seen.filter((r) => r.operation === 'redirect-target')).toHaveLength(0);
	} finally {
		await f.close();
	}
});

test('API CLI raw requests retain methods and bodies, binary output and HTTP errors', async () => {
	const f = await apiFixture('hosted');
	try {
		const result = await f.cli(['request', 'PATCH', '/api/custom', '--input', '{"enabled":true}']);
		expect(JSON.parse(result.stdout)).toMatchObject({ method: 'PATCH', body: { enabled: true } });
		const output = join(f.directory, 'raw.png');
		await f.cli(['get', '/api/raw-image', '--output', output]);
		expect(await readFile(output)).toEqual(png);
		const denied = await f.cli(['get', '/api/denied'], false);
		expect(denied.stderr).toMatch(/403.*forbidden|forbidden.*403/);
	} finally {
		await f.close();
	}
});
