import type { Fixture } from './prepare-project-run.test.types';
import { expect, test } from 'vitest';
import type { ProjectRunRequest } from '../../src/models/DesktopBridge.types';
import { fixture, git, approve } from '../run-fixture';
import { currentFixture, capture, imageBytes, imageHash } from '../current-image.test.fixtures';
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

test('current image callback is lazy and pins exact project revision and artifact bindings', async () => {
	const { f, query, response, evidence, prepare } = await currentFixture();
	const context = await prepare();
	expect(git(f.root, 'rev-parse', 'HEAD')).not.toBe(query.commit);
	expect(response.scope.atTip).toBe(false);
	expect(query.mode).toBe('commit');
	expect(evidence.evidence).not.toHaveBeenCalled();
	expect(evidence.artifact).not.toHaveBeenCalled();
	expect(context.currentImage).toBeTypeOf('function');
	f.request.entityId = 'foreign.entity';
	await expect(context.currentImage!()).resolves.toEqual(imageBytes);
	expect(evidence.evidence).toHaveBeenCalledExactlyOnceWith(query);
	expect(evidence.artifact).toHaveBeenCalledExactlyOnceWith({
		...query,
		side: 'after',
		recordId: 'record-a',
		scenarioId: 'scenario.page',
		state: 'default',
		evidenceId: 'screen-a',
		viewport: 'desktop',
		sha256: imageHash,
		notesRevision: response.identity.notesRevision,
		evidenceRevision: response.identity.evidenceRevision
	});
});

test('current image chooses matching current usable nonfocused screenshots deterministically', async () => {
	const { response, evidence, prepare } = await currentFixture();
	const wrongState = capture('wrong-state');
	wrongState.state = 'loading';
	const wrongViewport = capture('wrong-viewport');
	wrongViewport.capture.viewport = 'mobile';
	const wrongKind = capture('wrong-kind');
	wrongKind.capture.kind = 'video';
	response.evidence.after.captures = [
		{ ...capture('unusable'), usable: false },
		{ ...capture('old'), current: false },
		wrongState,
		wrongViewport,
		wrongKind,
		capture('screen-z'),
		capture('screen-a')
	];
	const focused = {
		...capture('focused'),
		focused: { loop: 'loop', status: 'passed', record: 'focused' }
	};
	response.evidence.after.captures.unshift(focused);
	const context = await prepare();
	expect(context.currentImage).toBeTypeOf('function');
	await context.currentImage!();
	expect(evidence.artifact.mock.calls[0][0].evidenceId).toBe('screen-a');
	response.evidence.after.captures.reverse();
	await context.currentImage!();
	expect(evidence.artifact.mock.calls[1][0].evidenceId).toBe('screen-a');
});

test('no eligible recorded screenshot returns null without reading an artifact', async () => {
	const { f, query, response, evidence, prepare } = await currentFixture();
	evidence.evidence.mockResolvedValue({
		...response,
		evidence: {
			...response.evidence,
			before: response.evidence.after,
			after: { ...response.evidence.after, captures: [] }
		}
	});
	const context = await prepare();
	expect(context.currentImage).toBeTypeOf('function');
	expect(git(f.root, 'rev-parse', 'HEAD')).not.toBe(query.commit);
	await expect(context.currentImage!()).resolves.toBeNull();
	expect(evidence.evidence).toHaveBeenCalledExactlyOnceWith(query);
	expect(evidence.artifact).not.toHaveBeenCalled();
});

test.each(['evidence', 'artifact'] as const)(
	'current image propagates %s refusal',
	async (boundary) => {
		const { evidence, prepare } = await currentFixture();
		const failure = new Error('stale-or-foreign-commit');
		evidence[boundary].mockRejectedValue(failure);
		const context = await prepare();
		expect(context.currentImage).toBeTypeOf('function');
		await expect(context.currentImage!()).rejects.toBe(failure);
		if (boundary === 'evidence') expect(evidence.artifact).not.toHaveBeenCalled();
	}
);

test.each(['bytes', 'hash', 'media', 'foreign', 'stale'] as const)(
	'current image refuses %s integrity mismatch',
	async (mismatch) => {
		const { response, evidence, prepare } = await currentFixture();
		if (mismatch === 'bytes')
			evidence.artifact.mockResolvedValue({
				bytes: new Uint8Array([1]),
				sha256: imageHash,
				mediaType: 'image/png'
			});
		if (mismatch === 'hash')
			evidence.artifact.mockResolvedValue({
				bytes: imageBytes,
				sha256: '0'.repeat(64),
				mediaType: 'image/png'
			});
		if (mismatch === 'media')
			evidence.artifact.mockResolvedValue({
				bytes: imageBytes,
				sha256: imageHash,
				mediaType: 'text/plain'
			});
		if (mismatch === 'foreign') response.identity.projectId = 'local-' + 'f'.repeat(64);
		if (mismatch === 'stale') response.identity.sourceCommit = 'f'.repeat(40);
		const context = await prepare();
		expect(context.currentImage).toBeTypeOf('function');
		await expect(context.currentImage!()).rejects.toThrow();
		if (mismatch === 'foreign' || mismatch === 'stale')
			expect(evidence.artifact).not.toHaveBeenCalled();
	}
);

test('Change and nonvisual preparation do not eagerly read screenshot evidence', async () => {
	const changed = await currentFixture();
	await changed.prepare(await approve(changed.f));
	expect(changed.evidence.evidence).not.toHaveBeenCalled();
	expect(changed.evidence.artifact).not.toHaveBeenCalled();
	const nonvisual = await currentFixture();
	const entity = await nonvisual.f.planning.createPlan({
		category: 'functions',
		title: 'Text',
		goal: 'No visual'
	});
	const thread = await nonvisual.f.planning.openThread({
		entityId: entity.id,
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	});
	await nonvisual.prepare({ ...nonvisual.f.request, entityId: entity.id, threadId: thread.id });
	expect(nonvisual.evidence.evidence).not.toHaveBeenCalled();
	expect(nonvisual.evidence.artifact).not.toHaveBeenCalled();
}, 20000);
