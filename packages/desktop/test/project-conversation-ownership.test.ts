import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import type { RunRequest } from '../src/models/DesktopBridge.types';
import { ProjectSessionService } from '../src/services/projects-sessions/project-session-service/ProjectSessionService';
import { DesktopRunService } from '../src/services/agents-providers/desktop-run-service/DesktopRunService';
import { ProviderDiscoveryService } from '../src/services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import { fixture, git, visualAnswer } from './run-fixture';

const contract = {
	inputs: [{ name: 'milliseconds', type: 'number' }],
	outputs: [{ name: 'formatted', type: 'string' }],
	errors: ['negative-value']
};
const proposal = JSON.stringify({
	category: 'functions',
	title: 'Format time',
	goal: 'Readable elapsed time',
	proposal: 'Input 1500 returns 1.5 seconds',
	contract
});
const request = (f: Awaited<ReturnType<typeof fixture>>) =>
	({
		intent: 'create',
		category: 'functions',
		mode: 'plan',
		provider: 'codex',
		model: 'selected',
		effort: 'high',
		text: 'Add a formatter',
		projectId: f.session.projectId!
	}) as unknown as RunRequest;

test('project creation excludes another client until the owning request finishes', async () => {
	const f = await fixture();
	let release!: () => void;
	let entered!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const ready = new Promise<void>((resolve) => {
		entered = resolve;
	});
	f.run.mockImplementation(async (turn) => {
		entered();
		await gate;
		return { text: proposal, model: turn.model };
	});
	const other = new ProjectSessionService({ arbiter: f.session.arbiter });
	await other.open(f.root);
	const service = new DesktopRunService(
		other,
		new ProviderDiscoveryService({ codex: f.runner, claude: f.runner }),
		() => {},
		f.renderMockups
	);
	await f.service.start(request(f));
	await ready;
	try {
		await expect(service.start(request(f))).rejects.toThrow(/active|run/i);
		expect(f.run).toHaveBeenCalledOnce();
	} finally {
		release();
	}
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	expect(
		(await f.planning.plans(git(f.root, 'rev-parse', 'HEAD'))).filter(
			(plan) => plan.title === 'Format time'
		)
	).toHaveLength(1);
	expect(other.busy).toBe(false);
}, 20000);

test('visual creation uses Sonnet HTML/CSS and saves a reviewable committed version', async () => {
	const f = await fixture();
	f.run.mockImplementation(async (turn) => ({
		text:
			visualAnswer(turn) ??
			JSON.stringify({
				category: 'components',
				title: 'Elapsed badge',
				goal: 'Display elapsed time',
				proposal: 'Readable elapsed badge on navy background',
				contract
			}),
		model: turn.model
	}));
	// A case of one design: it asks for a single design option.
	await f.service.start({ ...request(f), designOptions: 1 });
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	const plan = (await f.planning.plans(git(f.root, 'rev-parse', 'HEAD'))).find(
		(item) => item.title === 'Elapsed badge'
	);
	expect(plan).toMatchObject({ category: 'components', lifecycle: 'review' });
	expect(plan!.versions[0].images).toHaveLength(4);
	expect(plan!.versions[0].commit).toMatch(/^[a-f0-9]{40}$/);
	expect(f.renderMockups).toHaveBeenCalledOnce();
	expect(f.run).toHaveBeenCalledTimes(2);
	expect(f.events).toContainEqual(expect.objectContaining({ kind: 'finished', verified: false }));
}, 20000);
