import { expect, test } from 'vitest';
import type { ProjectRunRequest } from '../../src/models/DesktopBridge.types';
import { fixture, git } from '../run-fixture';

type Fixture = Awaited<ReturnType<typeof fixture>>;
const asked = (f: Fixture, change: object = {}) =>
	({
		intent: 'create',
		projectId: f.session.projectId,
		category: 'functions',
		mode: 'plan',
		provider: 'codex',
		model: 'selected',
		effort: 'high',
		text: 'Add a formatter',
		...change
	}) as ProjectRunRequest;

test('a model the provider did not list is refused before anything is asked or written', async () => {
	const f = await fixture();
	const before = git(f.root, 'rev-parse', 'HEAD');
	await expect(f.service.start(asked(f, { model: 'unlisted' }))).rejects.toThrow();
	expect(f.run).not.toHaveBeenCalled();
	expect([f.session.busy, git(f.root, 'rev-parse', 'HEAD')]).toEqual([false, before]);
});

test('a past commit and a Change add nothing to a project', async () => {
	const f = await fixture();
	await expect(f.service.start(asked(f, { mode: 'change' }))).rejects.toThrow(
		/asked for as a Plan/
	);
	await f.session.snapshot({ branch: 'main', commit: git(f.root, 'rev-parse', 'HEAD') });
	await expect(f.service.start(asked(f))).rejects.toThrow(/read-only/);
	expect(f.run).not.toHaveBeenCalled();
	expect(f.session.busy).toBe(false);
});

test.each([
	['no project', undefined, /names its project/],
	['a name that is no project identity', 'alpha', /names its project/],
	['a path', '../local-' + 'a'.repeat(64), /names its project/],
	['another local project', 'local-' + 'f'.repeat(64), /not selected/],
	['a hosted project that is not open', '0f8fad5b-d9cb-469f-a165-70867728950e', /not selected/]
])(
	'a creation request with %s is refused before anything is asked',
	async (_name, projectId, why) => {
		const f = await fixture();
		await expect(f.service.start(asked(f, { projectId }))).rejects.toThrow(why);
		expect(f.run).not.toHaveBeenCalled();
		expect(f.session.busy).toBe(false);
	}
);
