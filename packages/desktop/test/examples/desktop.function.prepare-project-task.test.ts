import { beforeEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { prepareProjectTask } from '../../src/utils/agents-providers/prepareProjectTask';
import { prepareChangeEnvironment } from '../../src/utils/projects-sessions/promoteChange';
import { RunCancelled } from '../../src/models/agents-providers/AgentRunner.types';
import type { Preparation } from '../../src/utils/agents-providers/prepareRun.types';
import type { ProjectTaskRequest } from '../../src/models/projects-sessions/ProjectTask.types';

vi.mock('../../src/utils/projects-sessions/promoteChange', () => ({
	prepareChangeEnvironment: vi.fn(async () => undefined)
}));

type Revision = { branch: string; commit: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COMMIT = 'a'.repeat(40);
const planning = { entries: [] as string[] };
const request = {
	intent: 'task',
	category: 'components',
	mode: 'ask',
	projectId: 'synthetic-project',
	branch: 'main',
	commit: COMMIT,
	provider: 'claude',
	model: 'synthetic-model',
	effort: 'high',
	text: 'Explain the synthetic toolbar'
} as unknown as ProjectTaskRequest;

/** A synthetic project session that reports the given refreshed revision. */
function sessionAt(revision: Revision) {
	const project = { root: '/synthetic/root', revision, planning };
	return {
		project,
		assertProject: vi.fn(),
		mutable: vi.fn(async () => project)
	};
}

/** A synthetic preparation whose provider selection resolves to the given runner. */
function preparationWith(session: ReturnType<typeof sessionAt>, select: () => unknown) {
	const providers = { select: vi.fn(async () => select()) };
	return {
		preparation: { session, providers, generator: {}, emit: vi.fn() } as unknown as Preparation,
		providers
	};
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise;
	} catch (error) {
		return error;
	}
	throw new Error('Expected preparation to reject.');
}

function recordCases(state: string, cases: Parameters<typeof recordExampleCases>[1]) {
	recordExampleCases(
		{
			unitId: 'desktop.function.prepare-project-task',
			symbol: 'prepareProjectTask',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

test('returns the context when the refreshed revision matches', async () => {
	const runner = { id: 'synthetic-runner' };
	const session = sessionAt({ branch: 'main', commit: COMMIT });
	const { preparation, providers } = preparationWith(session, () => runner);
	const controller = new AbortController();

	const context = await prepareProjectTask(preparation, request, controller);

	expect(session.assertProject).toHaveBeenCalledWith('synthetic-project');
	expect(prepareChangeEnvironment).toHaveBeenCalledWith(session, request);
	expect(providers.select).toHaveBeenCalledWith('claude', 'synthetic-model', 'high');
	expect(context.preparation).toBe(preparation);
	expect(context.project).toBe(session.project);
	expect(context.root).toBe('/synthetic/root');
	expect(context.revision).toEqual({ branch: 'main', commit: COMMIT });
	expect(context.planning).toBe(planning);
	expect(context.request).toBe(request);
	expect(context.runner).toBe(runner);
	expect(context.id).toMatch(UUID);
	expect(context.signal).toBe(controller.signal);
	expect(context.signal.aborted).toBe(false);

	recordCases('returns-the-context-when-the-refreshed-revision-matches', [
		{
			name: 'context for the matching revision',
			input: { branch: 'main', commit: COMMIT, provider: 'claude', model: 'synthetic-model' },
			output: {
				root: context.root,
				revision: context.revision,
				requestCommit: context.request.commit,
				runner: context.runner,
				idIsUuid: UUID.test(context.id),
				signalAborted: context.signal.aborted
			}
		}
	]);
});

test('rejects a request whose branch or commit changed before the run', async () => {
	const cases: Parameters<typeof recordCases>[1] = [];
	const changed: Array<[string, Revision]> = [
		['refreshed branch differs', { branch: 'feature', commit: COMMIT }],
		['refreshed commit differs', { branch: 'main', commit: 'b'.repeat(40) }]
	];
	for (const [name, revision] of changed) {
		const session = sessionAt(revision);
		const select = vi.fn(async () => ({ id: 'unused-runner' }));
		const providers = { select };
		const preparation = {
			session,
			providers,
			generator: {},
			emit: vi.fn()
		} as unknown as Preparation;
		const error = await thrownBy(prepareProjectTask(preparation, request, new AbortController()));

		expect(error).toBeInstanceOf(Error);
		expect(error).toMatchObject({
			name: 'ProjectRevisionChangedError',
			message: 'The project revision changed. Refresh before asking the agent.'
		});
		expect(select).not.toHaveBeenCalled();
		cases.push({
			name,
			input: { requestBranch: 'main', requestCommit: COMMIT, refreshed: revision },
			error: { name: (error as Error).name, message: (error as Error).message }
		});
	}

	recordCases('rejects-a-request-whose-branch-or-commit-changed-before-the-run', cases);
});

test('cancels when aborted after runner selection', async () => {
	const session = sessionAt({ branch: 'main', commit: COMMIT });
	const controller = new AbortController();
	const { preparation, providers } = preparationWith(session, () => {
		controller.abort();
		return { id: 'synthetic-runner' };
	});

	const error = await thrownBy(prepareProjectTask(preparation, request, controller));

	expect(error).toBeInstanceOf(RunCancelled);
	expect(error).toMatchObject({ name: 'RunCancelled', message: 'The run was cancelled.' });
	expect(providers.select).toHaveBeenCalledTimes(1);
	expect(session.mutable).toHaveBeenCalledTimes(1);

	recordCases('cancels-when-aborted-after-runner-selection', [
		{
			name: 'abort during provider selection',
			input: { provider: 'claude', model: 'synthetic-model', effort: 'high' },
			error: { name: (error as Error).name, message: (error as Error).message }
		}
	]);
});
