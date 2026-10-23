import { observedProviderExit } from './cli-process-fixture';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { test } from 'vitest';
import { ResourceQueueRepository } from '../../../src/services/execution-runtimes/resource-queue-service/ResourceQueueRepository';
import { expect } from '../../../test/verificationExpect';
import { CodexAppServerAdapter } from '../src/adapters/codex-app-server-adapter/CodexAppServerAdapter';
import { alive, fixture, pids, png, resourceTelemetry, turn } from './cli-fixture';
test('Codex initializes subscription RPC, discovers models and confines public turn events', async () => {
	const f = await fixture('codex-text');
	const discovered = await f.adapter.discover();
	expect(discovered).toMatchObject({ available: true, imageGeneration: true });
	expect(discovered.models.map((m) => m.id)).toEqual(['selected']);
	const request = turn(f.root);
	expect(await f.adapter.run(request)).toEqual({ text: 'Public answer', model: 'selected' });
	expect(request.onText).toHaveBeenCalledExactlyOnceWith('Public answer');
	const events = await f.events();
	expect(events.find((e) => e.method === 'turn/start')?.resources).toBeUndefined();
	expect(events.filter((e) => e.argv?.includes('app-server')).at(-1)?.resources).toMatchObject({
		lease: expect.any(String),
		cpus: '1',
		threads: '1'
	});
	expect(events.every((e) => !e.env?.length)).toBe(true);
	expect(events.find((e) => e.method === 'initialize')?.params).toMatchObject({
		capabilities: { experimentalApi: true }
	});
	expect(events.some((e) => e.method === 'initialized')).toBe(true);
	expect(events.find((e) => e.method === 'thread/start')?.params).toMatchObject({
		cwd: f.root,
		model: 'selected',
		modelProvider: 'openai',
		sandbox: 'read-only',
		approvalPolicy: 'never',
		ephemeral: true
	});
	expect(events.find((e) => e.method === 'turn/start')?.params).toMatchObject({
		model: 'selected',
		effort: 'high',
		summary: 'none',
		input: [{ type: 'text', text: 'Requested task' }]
	});
	const serverArgs = 'app-server --stdio -c model_provider="openai"';
	expect(events.find((e) => e.argv?.includes('app-server'))?.argv).toEqual(serverArgs.split(' '));
});
test.each(['codex-none', 'codex-error'])(
	'%s refuses text or errors as image success',
	async (mode) => {
		const f = await fixture(mode);
		const adapter = new CodexAppServerAdapter(f.command, f.queue);
		await expect(adapter.generateImage({ ...turn(f.root), reference: null })).rejects.toThrow();
	}
);
test('completed image returns PNG bytes and transmits its original local image reference', async () => {
	const f = await fixture('codex-image');
	const reference = join(f.root, 'original.png');
	await writeFile(reference, Buffer.from(png, 'base64'));
	const image = await new CodexAppServerAdapter(f.command, f.queue).generateImage({
		...turn(f.root),
		reference
	});
	expect(image.bytes).toEqual(Buffer.from(png, 'base64'));
	expect(image.revisedPrompt).toBe('Revised prompt');
	expect((await f.events()).find((e) => e.method === 'turn/start')?.params?.input).toEqual(
		expect.arrayContaining([{ type: 'localImage', path: reference }])
	);
});
test('Claude uses requested model, project cwd, stdin and subscription-only environment', async () => {
	const f = await fixture('claude-text');
	expect((await f.adapter.discover()).available).toBe(true);
	const request = turn(f.root);
	expect(await f.adapter.run(request)).toEqual({ text: 'Public answer', model: 'selected' });
	expect(request.onText).toHaveBeenCalledExactlyOnceWith('Public answer');
	const events = await f.events();
	const run = events.find((e) => e.argv?.includes('-p'));
	expect(run?.cwd).toBe(f.root);
	expect(run?.resources).toMatchObject({ lease: expect.any(String), cpus: '1', threads: '1' });
	const flags =
		'-p --verbose --output-format stream-json --model selected --permission-mode bypassPermissions --no-session-persistence --effort high --tools Read,Glob,Grep';
	expect(run?.argv).toEqual(flags.split(' '));
	expect(events.every((e) => !e.env?.length)).toBe(true);
	expect(events.find((e) => e.kind === 'prompt')?.input).toBe('Requested task');
});
test.each(['codex-mismatch', 'claude-mismatch', 'claude-error'])(
	'%s rejects false success',
	async (mode) => {
		const f = await fixture(mode);
		await expect(f.adapter.run(turn(f.root))).rejects.toThrow();
	}
);
test.each(['codex-hang', 'claude-hang'])(
	'%s cancellation kills only the owned process group',
	async (mode) => {
		const f = await fixture(mode);
		const controller = new AbortController();
		const unrelated = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
			stdio: 'ignore'
		});
		pids.push(unrelated.pid!);
		const result = f.adapter.run(turn(f.root, controller.signal)).then(
			() => null,
			(error) => error
		);
		await expect.poll(async () => (await f.events()).some((e) => e.kind === 'owned')).toBe(true);
		const events = await f.events();
		const owned = events.filter((e) => e.pid).map((e) => e.pid!);
		pids.push(...owned);
		controller.abort();
		expect(await result).toMatchObject({ name: 'RunCancelled' });
		await expect.poll(() => owned.every((pid) => !alive(pid))).toBe(true);
		expect(alive(unrelated.pid!)).toBe(true);
	}
);

test.each(['codex-text', 'claude-text'])(
	'%s waits under memory pressure and queued cancellation launches no provider',
	async (mode) => {
		const f = await fixture(mode),
			controller = new AbortController(),
			request = turn(f.root, controller.signal);
		resourceTelemetry.pressure = true;
		const result = f.adapter.run(request).catch((error) => error);
		await expect
			.poll(() => request.onStatus)
			.toHaveBeenCalledWith(expect.stringContaining('Waiting for resources: Memory pressure'));
		expect(await f.events()).toEqual([]);
		controller.abort();
		expect(await result).toMatchObject({ name: 'RunCancelled' });
		const queue = new ResourceQueueRepository(join(f.root, 'resources'));
		try {
			expect(queue.all()).toEqual([]);
		} finally {
			queue.close();
		}
	}
);

test.each(
	['bun', 'node'].flatMap((runtime) =>
		['cli', 'rpc'].flatMap((transport) => [0, 150].map((delay) => ({ runtime, transport, delay })))
	)
)(
	'$runtime $transport retains fast child results during a $delay ms resource observer',
	async ({ runtime, transport, delay }) => {
		const result = await observedProviderExit(runtime, transport, delay);
		expect(result.exit, result.stderr + result.stdout).toBe(0);
		expect(result.stderr).toBe('');
		expect(JSON.parse(result.stdout)).toEqual(
			transport === 'cli'
				? { status: 'passed', result: 'out\n' }
				: { status: 'rejected', message: 'Codex connection closed.' }
		);
	},
	30_000
);
