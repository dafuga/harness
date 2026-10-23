import type { PowerEvent } from './remote-lifecycle.test.types';
import { expect, test } from 'vitest';
import { RemoteLifecycleService } from '../../src/services/RemoteLifecycleService';
function setup(enabled = true) {
	const listeners = new Map<string, (() => void)[]>(),
		calls: string[] = [];
	const lifecycle = new RemoteLifecycleService({
		power: {
			on: (event, listener) => listeners.set(event, [...(listeners.get(event) ?? []), listener])
		},
		host: {
			enabled: () => enabled,
			suspend: () => calls.push('suspend'),
			resume: () => calls.push('resume'),
			stop: async () => {
				calls.push('stop');
			}
		},
		cancelLocal: () => calls.push('cancel-local')
	});
	lifecycle.start();
	const fire = (event: PowerEvent) =>
		(listeners.get(event) ?? []).forEach((listener) => listener());
	return { lifecycle, calls, fire };
}

test('locking and unlocking the screen changes nothing for the remote backend', () => {
	const f = setup();
	f.fire('lock-screen');
	expect(f.lifecycle.locked).toBe(true);
	f.fire('unlock-screen');
	expect(f.lifecycle.locked).toBe(false);
	expect(f.calls).toEqual([]);
});
test('system suspension takes the host offline once, and waking reconnects it once', () => {
	const f = setup();
	f.fire('lock-screen');
	f.fire('suspend');
	f.fire('suspend');
	expect(f.lifecycle.suspended).toBe(true);
	expect(f.calls).toEqual(['suspend']);
	f.fire('resume');
	f.fire('resume');
	f.fire('unlock-screen');
	expect(f.lifecycle.suspended).toBe(false);
	expect(f.calls).toEqual(['suspend', 'resume']);
});
test('closing the last window keeps an enabled remote backend, and ends the app otherwise', () => {
	const enabled = setup(true),
		disabled = setup(false);
	expect(enabled.lifecycle.windowsClosed()).toBe('keep');
	expect(disabled.lifecycle.windowsClosed()).toBe('quit');
	expect(enabled.calls).toEqual(['cancel-local']);
	expect(disabled.calls).toEqual(['cancel-local']);
});
test('quit ends the remote backend and every run, once', async () => {
	const f = setup();
	await f.lifecycle.quit();
	await f.lifecycle.quit();
	expect(f.calls).toEqual(['cancel-local', 'stop']);
});
