import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { prepareProjectRun } from '../../src/services/agents-providers/desktop-run-service/prepareProjectRun';
import type { Preparation } from '../../src/utils/agents-providers/prepareRun';
import type { ProjectRunRequest } from '../../src/models/development-tooling/DesktopBridge.types';

const projectId = '9f2c7a61-b4e3-4a8d-9f01-2c6b5a7d8e90';
const request = {
	intent: 'create',
	projectId,
	category: 'functions',
	mode: 'plan',
	provider: 'codex',
	model: 'gpt-5.1-codex',
	effort: 'medium',
	text: 'Create a function that normalizes uploaded project paths.',
	designOptions: 3
} as ProjectRunRequest;

/** A fake preparation that records each call in order, so the tests can prove what was asked. */
function fakePreparation({
	open = projectId,
	onSelect
}: { open?: string; onSelect?: () => void } = {}) {
	const calls: string[] = [];
	const runner = { id: 'runner-fixture' };
	const preparation = {
		session: {
			assertProject(id?: string) {
				calls.push(`assertProject:${id}`);
				if (id !== undefined && id !== open)
					throw new Error('The requested project is not selected.');
			},
			async mutable() {
				calls.push('mutable');
				return { root: 'project-root-fixture', revision: 'rev-fixture', planning: 'plan-fixture' };
			}
		},
		providers: {
			async select(provider: string, model: string, effort: string | null) {
				calls.push(`select:${provider}:${model}:${effort}`);
				onSelect?.();
				return runner;
			}
		},
		generator: {},
		emit() {}
	} as unknown as Preparation;
	return { preparation, calls, runner };
}

async function thrownFrom(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise;
	} catch (error) {
		return error;
	}
	throw new Error('Expected the call to throw.');
}

test('resolves a create Plan after the project and runner are checked, with a fresh id', async () => {
	const { preparation, calls, runner } = fakePreparation();
	const controller = new AbortController();
	const context = await prepareProjectRun(preparation, request, controller);

	expect(calls).toEqual([
		`assertProject:${projectId}`,
		'mutable',
		'select:codex:gpt-5.1-codex:medium'
	]);
	const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
	expect(context.id).toMatch(uuid);
	expect({
		root: context.root,
		revision: context.revision,
		planning: context.planning,
		project: context.project,
		runner: context.runner,
		request: context.request,
		signal: context.signal,
		preparation: context.preparation
	}).toEqual({
		root: 'project-root-fixture',
		revision: 'rev-fixture',
		planning: 'plan-fixture',
		project: { root: 'project-root-fixture', revision: 'rev-fixture', planning: 'plan-fixture' },
		runner,
		request,
		signal: controller.signal,
		preparation
	});

	recordExampleCases(
		{
			unitId: 'desktop.function.prepare-project-run',
			symbol: 'prepareProjectRun',
			state: 'resolves-a-create-plan-after-project-and-runner-checks',
			evidence: 'examples-cases',
			file: 'resolves-a-create-plan-after-project-and-runner-checks.json'
		},
		[
			{
				name: 'create plan for the open project',
				input: {
					projectId,
					intent: 'create',
					mode: 'plan',
					provider: 'codex',
					model: 'gpt-5.1-codex',
					effort: 'medium'
				},
				output: {
					calls,
					root: context.root,
					revision: context.revision,
					planning: context.planning,
					idIsUuidV4: uuid.test(context.id),
					signalAborted: context.signal.aborted
				}
			}
		]
	);
});

test('refuses a request that is not a create Plan before anything is asked', async () => {
	const { preparation, calls } = fakePreparation();
	const change = { ...request, mode: 'change' } as unknown as ProjectRunRequest;
	const ask = { ...request, intent: 'ask' } as unknown as ProjectRunRequest;
	const errors = [
		await thrownFrom(prepareProjectRun(preparation, change, new AbortController())),
		await thrownFrom(prepareProjectRun(preparation, ask, new AbortController()))
	];

	expect(errors[0]).toBeInstanceOf(Error);
	expect(errors[0]).toMatchObject({ message: 'Something new is asked for as a Plan.' });
	expect(errors[1]).toMatchObject({ message: 'Something new is asked for as a Plan.' });
	expect(calls).toEqual([]);

	recordExampleCases(
		{
			unitId: 'desktop.function.prepare-project-run',
			symbol: 'prepareProjectRun',
			state: 'refuses-a-request-that-is-not-a-create-plan',
			evidence: 'examples-cases',
			file: 'refuses-a-request-that-is-not-a-create-plan.json'
		},
		[
			{
				name: 'change mode is refused',
				input: { intent: 'create', mode: 'change' },
				error: { name: (errors[0] as Error).name, message: (errors[0] as Error).message }
			},
			{
				name: 'ask intent is refused',
				input: { intent: 'ask', mode: 'plan' },
				error: { name: (errors[1] as Error).name, message: (errors[1] as Error).message }
			}
		]
	);
});

test('refuses a request for a project that is not the open one before selecting a runner', async () => {
	const { preparation, calls } = fakePreparation({ open: '0f8fad5b-d9cb-469f-a165-70867728950e' });
	const error = await thrownFrom(prepareProjectRun(preparation, request, new AbortController()));

	expect(error).toMatchObject({ message: 'The requested project is not selected.' });
	expect(calls).toEqual([`assertProject:${projectId}`]);

	recordExampleCases(
		{
			unitId: 'desktop.function.prepare-project-run',
			symbol: 'prepareProjectRun',
			state: 'refuses-a-request-for-an-unselected-project',
			evidence: 'examples-cases',
			file: 'refuses-a-request-for-an-unselected-project.json'
		},
		[
			{
				name: 'named project is not open',
				input: { projectId },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});

test('stops a run cancelled during runner preparation before returning a context', async () => {
	const controller = new AbortController();
	const { preparation, calls } = fakePreparation({ onSelect: () => controller.abort() });
	const error = await thrownFrom(prepareProjectRun(preparation, request, controller));

	expect(error).toMatchObject({ name: 'RunCancelled' });
	expect(calls).toEqual([
		`assertProject:${projectId}`,
		'mutable',
		'select:codex:gpt-5.1-codex:medium'
	]);

	recordExampleCases(
		{
			unitId: 'desktop.function.prepare-project-run',
			symbol: 'prepareProjectRun',
			state: 'stops-a-run-cancelled-before-the-context-is-returned',
			evidence: 'examples-cases',
			file: 'stops-a-run-cancelled-before-the-context-is-returned.json'
		},
		[
			{
				name: 'abort after runner selection',
				input: { projectId, provider: 'codex', model: 'gpt-5.1-codex', effort: 'medium' },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});
