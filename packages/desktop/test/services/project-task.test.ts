import type { Fixture } from './project-task.test.types';
import { expect } from '../../../../test/verificationExpect';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import type { ComponentManifest } from '../../../../src/lib/contracts';
import type { ProjectTaskRequest } from '../../src/models/DesktopBridge.types';
import { fixture, git } from '../run-fixture';
const target = 'fixture.function.requested';
const reference = `[[unit:${target}]]`;
function units(f: Fixture, many = false) {
	const manifest = (id: string, source: string[]) =>
		({
			id,
			title: id,
			responsibility: 'Fixture responsibility',
			owns: { source }
		}) as ComponentManifest;
	const catalog = many
		? Array.from({ length: 130 }, (_, index) =>
				manifest(`fixture.function.other-${index}`, [`src/other-${index}.ts`])
			)
		: [];
	catalog.push(manifest(target, ['src/owned.ts']));
	vi.spyOn(f.session.requireProject().source, 'units').mockResolvedValue(catalog);
}
async function run(
	f: Fixture,
	mode: 'ask' | 'change',
	text = `Explain ${target}`,
	environment?: 'stage'
) {
	const request: ProjectTaskRequest = {
		intent: 'task',
		category: 'functions',
		mode,
		projectId: f.session.projectId!,
		branch: 'main',
		commit: git(f.root, 'rev-parse', 'HEAD'),
		provider: 'codex',
		model: 'selected',
		effort: 'high',
		text,
		...(environment ? { environment } : {})
	};
	const started = await f.service.start(request);
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	return started;
}

test('Ask preserves source and a returned answer containing a registered unit reference', async () => {
	const f = await fixture();
	units(f);
	const answer = `${reference} owns the selected source.`,
		before = git(f.root, 'rev-parse', 'HEAD');
	f.run.mockImplementation(async (turn) => ({ text: answer, model: turn.model }));
	const started = await run(f, 'ask');
	expect(f.run.mock.calls[0][0].access).toBe('read-only');
	expect(f.run.mock.calls[0][0].prompt).toContain(reference);
	expect(f.events).toContainEqual({ runId: started.runId, kind: 'text', text: answer });
	expect(f.events).toContainEqual({ runId: started.runId, kind: 'changes', files: [] });
	expect(await readFile(join(f.root, 'src/owned.ts'), 'utf8')).toBe('committed source');
	expect(git(f.root, 'diff', '--name-only')).toBe('');
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(before);
	expect(f.events.at(-1)).toMatchObject({ kind: 'finished', summary: 'Answer complete.' });
}, 20000);

test('a requested registered unit beyond the first 120 is prioritized in the bounded prompt', async () => {
	const f = await fixture();
	units(f, true);
	await run(f, 'ask');
	const prompt = f.run.mock.calls[0][0].prompt;
	const listed = prompt.split('Units you may name: ')[1].split('\n')[0];
	expect(listed.startsWith(reference)).toBe(true);
	expect(listed.match(/\[\[unit:/g)).toHaveLength(120);
	expect(f.events.at(-1)).toMatchObject({ kind: 'finished' });
}, 20000);

test('Change reports actual registered source owners rather than the requested subject', async () => {
	const f = await fixture(async (turn) => {
		expect(turn.access).toBe('write');
		await writeFile(join(turn.cwd, 'src/owned.ts'), 'requested repair');
	});
	units(f);
	await run(f, 'change', 'Repair a different subject');
	expect(f.events).toContainEqual(
		expect.objectContaining({
			kind: 'changes',
			files: expect.arrayContaining([expect.objectContaining({ path: 'src/owned.ts' })])
		})
	);
	expect(f.events).toContainEqual(
		expect.objectContaining({
			kind: 'status',
			phase: 'recording',
			detail: expect.stringContaining(`Units changed: ${reference}`)
		})
	);
	expect(f.events.at(-1)).toMatchObject({ kind: 'finished', verified: false });
}, 20000);

test('an unexpected Ask write fails and preserves the changed file for review', async () => {
	const f = await fixture(async (turn) => {
		expect(turn.access).toBe('read-only');
		await writeFile(join(turn.cwd, 'src/owned.ts'), 'unexpected retained edit');
	});
	units(f);
	await run(f, 'ask');
	expect(f.events.at(-1)).toMatchObject({
		kind: 'failed',
		message: 'The read-only agent changed files. Changes were preserved for review.'
	});
	expect(f.events.some((event) => event.kind === 'finished')).toBe(false);
	expect(await readFile(join(f.root, 'src/owned.ts'), 'utf8')).toBe('unexpected retained edit');
	expect(f.events).toContainEqual(
		expect.objectContaining({ kind: 'status', detail: expect.stringContaining(reference) })
	);
}, 20000);

test('a scoped project change refuses missing deployment configuration before an agent writes', async () => {
	const f = await fixture();
	await expect(run(f, 'change', 'Make the requested change', 'stage')).rejects.toThrow();
	expect(f.run).not.toHaveBeenCalled();
}, 20000);
