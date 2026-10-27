import { expect, test } from 'vitest';
import {
	adapter,
	deferred,
	input,
	makeRig,
	requireReady,
	requireRun,
	runQualifiedCase,
	tools
} from './module-task-broker-transport.test.fixtures';
import type { ClientResult, Session, Tools } from './module-task-broker-transport.test.types';

test('ModuleTaskBrokerTransportAdapter.ready from qualified initialization', async () => {
	const rig = makeRig();
	requireReady(rig.adapter);
	await expect(rig.adapter.ready()).resolves.toBeUndefined();
	expect(rig.calls).toEqual({ ready: 1, open: 0, run: 0, close: 0 });
});

test('ModuleTaskBrokerTransportAdapter.ready from unconfigured initialization', async () => {
	const value = adapter();
	requireReady(value);
	await expect(value.ready()).rejects.toMatchObject({
		name: 'Error',
		message: 'Broker transport is unqualified'
	});
});

test('ModuleTaskBrokerTransportAdapter.ready from qualification-rejected initialization', async () => {
	const rig = makeRig({
		clientReady: async () => {
			throw new Error('Synthetic qualification rejected');
		}
	});
	requireReady(rig.adapter);
	await expect(rig.adapter.ready()).rejects.toMatchObject({
		message: 'Synthetic qualification rejected'
	});
	expect(rig.calls).toEqual({ ready: 1, open: 0, run: 0, close: 0 });
});

test('ModuleTaskBrokerTransportAdapter.run from invalid-input initialization', async () => {
	const rig = makeRig();
	requireRun(rig.adapter);
	const base = input();
	const invalid = [
		input({ scope: undefined }),
		input({ provider: 'claude' }),
		input({ scope: { ...base.scope!, scratch: base.cwd } })
	];
	for (const value of invalid)
		await expect(rig.adapter.run(value)).rejects.toMatchObject({
			message: 'Invalid broker task input'
		});
	expect(rig.calls).toEqual({ ready: 0, open: 0, run: 0, close: 0 });
});

test('ModuleTaskBrokerTransportAdapter.run from qualification-rejected initialization', async () => {
	const rig = makeRig({
		clientReady: async () => {
			throw new Error('Synthetic qualification rejected');
		}
	});
	requireRun(rig.adapter);
	await expect(rig.adapter.run(input())).rejects.toMatchObject({
		message: 'Synthetic qualification rejected'
	});
	expect(rig.calls).toEqual({ ready: 1, open: 0, run: 0, close: 0 });
});

test('ModuleTaskBrokerTransportAdapter.run from open-failed initialization', async () => {
	const rig = makeRig({
		openBroker: async () => {
			throw new Error('Synthetic broker open failed');
		}
	});
	requireRun(rig.adapter);
	await expect(rig.adapter.run(input())).rejects.toMatchObject({
		message: 'Synthetic broker open failed'
	});
	expect(rig.calls).toEqual({ ready: 1, open: 1, run: 0, close: 0 });
});

test('ModuleTaskBrokerTransportAdapter.run from invalid-session initialization', async () => {
	const incomplete: Partial<Tools> = tools();
	delete incomplete.writeAssigned;
	const rig = makeRig({ tools: incomplete });
	requireRun(rig.adapter);
	await expect(rig.adapter.run(input())).rejects.toMatchObject({
		message: 'Invalid broker session'
	});
	expect(rig.calls).toEqual({ ready: 1, open: 1, run: 0, close: 1 });
});

test('ModuleTaskBrokerTransportAdapter.run from qualified initialization', async () => {
	await runQualifiedCase();
});

test('ModuleTaskBrokerTransportAdapter.run from client-failed initialization', async () => {
	const rig = makeRig({
		clientRun: async () => {
			throw new Error('Synthetic client failed');
		},
		close: async () => {
			throw new Error('Synthetic broker cleanup failed');
		}
	});
	requireRun(rig.adapter);
	await expect(rig.adapter.run(input())).rejects.toMatchObject({
		message: 'Synthetic client failed'
	});
	expect(rig.events).toEqual(['ready', 'open', 'client', 'close']);
});

test('ModuleTaskBrokerTransportAdapter.run from cancelled-before initialization', async () => {
	const rig = makeRig();
	requireRun(rig.adapter);
	const controller = new AbortController();
	controller.abort();
	await expect(rig.adapter.run(input({ signal: controller.signal }))).rejects.toMatchObject({
		name: 'AbortError',
		message: 'Broker task cancelled'
	});
	expect(rig.calls).toEqual({ ready: 0, open: 0, run: 0, close: 0 });
});

test('ModuleTaskBrokerTransportAdapter.run from cancelled-opening initialization', async () => {
	const entered = deferred<void>();
	const release = deferred<Session>();
	const rig = makeRig({
		openBroker: async () => {
			entered.resolve(undefined);
			return release.promise;
		}
	});
	requireRun(rig.adapter);
	const controller = new AbortController();
	const pending = rig.adapter.run(input({ signal: controller.signal }));
	await entered.promise;
	controller.abort();
	release.resolve(rig.session);
	await expect(pending).rejects.toMatchObject({
		name: 'AbortError',
		message: 'Broker task cancelled'
	});
	expect(rig.calls).toEqual({ ready: 1, open: 1, run: 0, close: 1 });
});

test('ModuleTaskBrokerTransportAdapter.run from cancelled-running initialization', async () => {
	const started = deferred<void>();
	const aborted = deferred<void>();
	const settled = deferred<ClientResult>();
	const rig = makeRig({
		clientRun: async (request) => {
			expect(request.signal).toBe(runInput.signal);
			request.signal.addEventListener(
				'abort',
				() => {
					rig.events.push('client-abort');
					aborted.resolve(undefined);
				},
				{ once: true }
			);
			started.resolve(undefined);
			await aborted.promise;
			const result = await settled.promise;
			rig.events.push('client-settled');
			return result;
		}
	});
	requireRun(rig.adapter);
	const controller = new AbortController();
	const runInput = input({ signal: controller.signal });
	const pending = rig.adapter.run(runInput);
	await started.promise;
	controller.abort();
	await aborted.promise;
	expect(rig.calls.close).toBe(0);
	settled.resolve({ text: 'settled after abort' });
	await expect(pending).rejects.toMatchObject({
		name: 'AbortError',
		message: 'Broker task cancelled'
	});
	expect(rig.events).toEqual([
		'ready',
		'open',
		'client',
		'client-abort',
		'client-settled',
		'close'
	]);
});

test('ModuleTaskBrokerTransportAdapter.run from cleanup-failed initialization', async () => {
	const rig = makeRig({
		close: async () => {
			throw new Error('Synthetic broker cleanup failed');
		}
	});
	requireRun(rig.adapter);
	await expect(rig.adapter.run(input())).rejects.toMatchObject({
		message: 'Synthetic broker cleanup failed'
	});
	expect(rig.calls).toEqual({ ready: 1, open: 1, run: 1, close: 1 });
});
