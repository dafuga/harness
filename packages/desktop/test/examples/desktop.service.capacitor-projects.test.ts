import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { CapacitorProjectsService } from '../../src/lib/verification-evidence/select-environment/CapacitorProjectsService';
import type {
	Input,
	Operation
} from '../../src/lib/verification-evidence/select-environment/CapacitorProjectsService.types';
import type { Methods, Bridge, Cases } from './desktop.service.capacitor-projects.test.types';

const unsubscribe = () => undefined;

/** A bridge with only the given methods; the service always subscribes to run events. */
function bridgeWith(methods: Methods): Bridge {
	return { onRunEvent: () => unsubscribe, ...methods } as unknown as Bridge;
}

function service(cloud: Methods, mac: Methods) {
	return new CapacitorProjectsService({ cloud: bridgeWith(cloud), mac: bridgeWith(mac) }).connect();
}

function projects(ids: string[]) {
	return ids.map((id) => ({ id, name: id, kind: id.startsWith('local-') ? 'local' : 'shared' }));
}

const answer = (ids: string[]) => () => Promise.resolve(projects(ids));
const refuse = (message: string) => () => Promise.reject(new Error(message));

function call(operation: unknown, input?: Input): Promise<unknown> {
	return (operation as Operation)(input);
}

const idsOf = (list: unknown) => (list as Array<{ id: string }>).map((project) => project.id);

async function outcome(
	run: () => Promise<unknown>
): Promise<{ output: unknown } | { error: unknown }> {
	try {
		return { output: await run() };
	} catch (error) {
		const failure = error as Error & { code?: string };
		return { error: { name: failure.name, message: failure.message, code: failure.code } };
	}
}

function record(state: string, symbol: string, cases: Cases) {
	recordExampleCases(
		{
			unitId: 'desktop.service.capacitor-projects',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

/** Records every call with the side that received it; a started run answers with its runId, as a bridge does. */
function recorder(side: string, calls: unknown[]): Methods {
	const log = (action: string) => async (input: unknown) => {
		calls.push({ side, action, input });
		const answer = `${side}-${action}`;
		return action === 'startRun' ? { runId: (input as Input).runId, answer } : answer;
	};
	return { startRun: log('startRun'), cancelRun: log('cancelRun') };
}

test('Lists account and Mac projects by their own kind', async () => {
	const bridge = service(
		{ listProjects: answer(['acct-1', 'local-x']) },
		{ listProjects: answer(['local-mac-1', 'acct-2']) }
	);
	const ids = idsOf(await call(bridge.listProjects)).sort();
	expect(ids).toEqual(['acct-1', 'local-mac-1']);
	record('lists-account-and-mac-projects-by-their-own-kind', 'connect', [
		{
			name: 'Account and Mac lists keep only their own project IDs',
			input: { cloud: ['acct-1', 'local-x'], mac: ['local-mac-1', 'acct-2'] },
			output: ids
		}
	]);
});

test('Routes run start and cancel to the bridge that started it', async () => {
	const calls: unknown[] = [];
	const bridge = service(recorder('cloud', calls), recorder('mac', calls));
	const started = await call(bridge.startRun, { projectId: 'local-mac-1', runId: 'run-1' });
	const cancelled = await call(bridge.cancelRun, { runId: 'run-1' });
	const other = await call(bridge.startRun, { projectId: 'acct-2', runId: 'run-2' });
	expect(started).toEqual({ runId: 'run-1', answer: 'mac-startRun' });
	expect(cancelled).toBe('mac-cancelRun');
	expect(other).toEqual({ runId: 'run-2', answer: 'cloud-startRun' });
	expect(calls).toEqual([
		{ side: 'mac', action: 'startRun', input: { projectId: 'local-mac-1', runId: 'run-1' } },
		{ side: 'mac', action: 'cancelRun', input: { runId: 'run-1' } },
		{ side: 'cloud', action: 'startRun', input: { projectId: 'acct-2', runId: 'run-2' } }
	]);
	record('routes-run-start-and-cancel-to-the-bridge-that-started-it', 'connect', [
		{
			name: 'Run start and cancel reach the bridge that started the run',
			input: [
				{ projectId: 'local-mac-1', runId: 'run-1' },
				{ runId: 'run-1' },
				{ projectId: 'acct-2', runId: 'run-2' }
			],
			output: { started, cancelled, other, calls }
		}
	]);
});

test('Refuses an operation the chosen bridge lacks', async () => {
	const bridge = service({ providers: async () => ['acct-provider'] }, {});
	const refused = await outcome(() => call(bridge.providers, { projectId: 'local-mac-1' }));
	const allowed = await outcome(() => call(bridge.providers, { projectId: 'acct-1' }));
	expect(refused).toEqual({
		error: {
			name: 'Error',
			message: 'This operation is not available for this project on this phone.',
			code: 'method-denied'
		}
	});
	expect(allowed).toEqual({ output: ['acct-provider'] });
	record('refuses-an-operation-the-chosen-bridge-lacks', 'connect', [
		{
			name: 'Mac project without providers is refused',
			input: { projectId: 'local-mac-1' },
			...refused
		},
		{
			name: 'Account project reaches the account bridge',
			input: { projectId: 'acct-1' },
			...allowed
		}
	]);
});

test('Rejects listing only when every listing bridge rejects', async () => {
	const oneDown = service(
		{ listProjects: refuse('cloud offline') },
		{ listProjects: answer(['local-mac-1']) }
	);
	const partial = idsOf(await call(oneDown.listProjects));
	const allDown = service(
		{ listProjects: refuse('cloud offline') },
		{ listProjects: refuse('mac offline') }
	);
	const rejected = await outcome(() => call(allDown.listProjects));
	expect(partial).toEqual(['local-mac-1']);
	expect(rejected).toEqual({ error: { name: 'Error', message: 'cloud offline', code: undefined } });
	record('rejects-listing-only-when-every-listing-bridge-rejects', 'connect', [
		{
			name: 'One listing bridge rejects and the other still lists',
			input: { cloud: 'offline', mac: ['local-mac-1'] },
			output: partial
		},
		{
			name: 'Every listing bridge rejects with the first reason',
			input: { cloud: 'offline', mac: 'offline' },
			...rejected
		}
	]);
});
