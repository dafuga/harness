import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import { RunCancelled } from '../src/models/AgentRunner.types';
import { approve, bytes, fixture, git, records, settled } from './run-fixture';
test('Plan uses read-only CLI and saves a committed immutable version without claiming verification', async () => {
	const f = await fixture();
	// A case of one design: it asks for a single design option.
	await settled(f, { ...f.request, designOptions: 1 });
	expect(f.run).toHaveBeenCalledOnce();
	expect(f.run.mock.calls[0][0]).toMatchObject({
		access: 'read-only',
		cwd: f.root,
		model: 'selected'
	});
	expect(f.run.mock.calls[0][0].prompt).toMatch(/why.*existing.*tests.*missed/i);
	expect(f.run.mock.calls[0][0].prompt).toContain('existing standardized test');
	expect(f.run.mock.calls[0][0].prompt).toContain('one-off');
	expect(f.run.mock.calls[0][0].prompt).toContain('missing coverage category');
	const plans = await f.planning.plans(git(f.root, 'rev-parse', 'HEAD'));
	expect(plans[0].versions).toHaveLength(1);
	expect(plans[0].versions[0].commit).toMatch(/^[a-f0-9]{40}$/);
	expect(f.events).toContainEqual(expect.objectContaining({ kind: 'finished', verified: false }));
	expect(plans[0].lifecycle).toBe('review');
}, 60000);
test('approval alone never runs and Change records untracked and previously dirty source deltas', async () => {
	const f = await fixture(async (turn) => {
		await writeFile(join(turn.cwd, 'src/owned.ts'), 'agent revision');
		await writeFile(join(turn.cwd, 'src/new.ts'), 'new source');
	});
	const request = await approve(f);
	expect(f.run).not.toHaveBeenCalled();
	expect(f.events).toEqual([]);
	await writeFile(join(f.root, 'src/owned.ts'), 'already dirty');
	await settled(f, request);
	expect(f.run.mock.calls[0][0].access).toBe('write');
	expect(f.run.mock.calls[0][0].prompt).toMatch(/why.*existing.*tests.*missed/i);
	expect(f.run.mock.calls[0][0].prompt).toContain('existing standardized test');
	expect(f.run.mock.calls[0][0].prompt).toContain('same unchanged');
	expect(f.run.mock.calls[0][0].prompt).toContain('one-off');
	expect(f.events).toContainEqual(
		expect.objectContaining({
			kind: 'changes',
			files: [
				{ path: 'src/new.ts', change: 'added' },
				{ path: 'src/owned.ts', change: 'modified' }
			]
		})
	);
	expect(f.events, 'unverified coding cannot finish successfully').toContainEqual(
		expect.objectContaining({
			kind: 'failed',
			message: expect.stringContaining('completion audit')
		})
	);
	expect((await records(f)).at(-1)).toMatchObject({
		status: 'failed',
		changedPaths: ['src/new.ts', 'src/owned.ts']
	});
}, 60000);

test('Plan rejects an incomplete proposal before generating or saving designs', async () => {
	const f = await fixture();
	f.run.mockResolvedValue({ text: 'Done.', model: 'selected' });
	await settled(f);
	expect(f.events, 'planning requires a completion audit').toContainEqual(
		expect.objectContaining({
			kind: 'failed',
			message: expect.stringContaining('completion audit')
		})
	);
	expect(f.generator.generateImage).not.toHaveBeenCalled();
	expect(f.events.some((event) => event.kind === 'finished')).toBe(false);
}, 60000);
test('stale approval is rejected before agent execution', async () => {
	const f = await fixture();
	const request = await approve(f);
	await f.planning.addDesign({
		entityId: request.entityId,
		prompt: 'New proposal',
		generator: { provider: 'codex', model: 'selected' },
		baseRevision: git(f.root, 'rev-parse', 'HEAD'),
		state: 'default',
		viewport: 'desktop',
		bytes
	});
	await expect(f.service.start(request)).rejects.toThrow('approved');
	expect(f.run).not.toHaveBeenCalled();
	expect(f.session.busy).toBe(false);
}, 60000);
test('image generation failure creates no invented image or successful completion', async () => {
	const f = await fixture();
	vi.mocked(f.generator.generateImage).mockRejectedValue(new Error('Image generation unavailable'));
	await settled(f);
	expect((await f.planning.plans(git(f.root, 'rev-parse', 'HEAD')))[0].versions).toEqual([]);
	expect(f.events.some((e) => e.kind === 'finished' || e.kind === 'design')).toBe(false);
	expect(f.events).toContainEqual(
		expect.objectContaining({ kind: 'failed', message: 'Image generation unavailable' })
	);
}, 60000);
test('failed Change never records a completed outcome', async () => {
	const f = await fixture(async (turn) => {
		await writeFile(join(turn.cwd, 'src/owned.ts'), 'partial change');
		throw new Error('Fixture agent failed');
	});
	await settled(f, await approve(f));
	const changes = await records(f);
	expect(changes.some((change) => change.status === 'completed')).toBe(false);
	expect(changes.at(-1)?.status).toBe('failed');
	expect(f.events.some((e) => e.kind === 'finished')).toBe(false);
	expect(f.events).toContainEqual(
		expect.objectContaining({ kind: 'failed', message: 'Fixture agent failed' })
	);
}, 60000);
test('cancelled Change records cancellation and cannot cancel another run ID', async () => {
	let entered!: () => void;
	const ready = new Promise<void>((resolve) => {
		entered = resolve;
	});
	const f = await fixture((turn) => {
		entered();
		return new Promise((_resolve, reject) =>
			turn.signal.addEventListener('abort', () => reject(new RunCancelled()), { once: true })
		);
	});
	const request = await approve(f);
	const started = await f.service.start(request);
	await ready;
	expect(f.run.mock.calls.length).toBe(1);
	expect(f.service.cancel('not-the-owner')).toBe(false);
	expect(f.session.busy).toBe(true);
	expect(f.service.cancel(started.runId)).toBe(true);
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	expect((await records(f)).at(-1)?.status).toBe('cancelled');
	expect((await records(f)).some((c) => c.status === 'completed')).toBe(false);
	expect(f.events).toContainEqual({ runId: started.runId, kind: 'cancelled' });
	expect(f.events.some((e) => e.kind === 'finished')).toBe(false);
}, 60000);
test('observed host writes retain actual absolute path and hashes in committed change history', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'harness-host-fixture-'));
	const path = join(directory, 'host.txt');
	await writeFile(path, 'before');
	try {
		const f = await fixture(async (turn) => {
			turn.onFile?.(path);
			await new Promise((resolve) => setTimeout(resolve, 30));
			await writeFile(path, 'after');
		});
		await settled(f, await approve(f));
		const changes = await records(f);
		const host = changes.flatMap((c) => c.hostChanges ?? []);
		expect(host).toEqual([
			expect.objectContaining({
				path,
				before: expect.stringMatching(/^[a-f0-9]{64}$/),
				after: expect.stringMatching(/^[a-f0-9]{64}$/),
				coverage: 'observed-cli-file-operation'
			})
		]);
		expect(host[0].before).not.toBe(host[0].after);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}, 60000);
