import { beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
	lock: vi.fn(() => true),
	quit: vi.fn(),
	on: vi.fn(),
	ready: vi.fn(() => new Promise<void>(() => undefined))
}));
vi.mock('electron', () => ({
	app: {
		requestSingleInstanceLock: state.lock,
		quit: state.quit,
		on: state.on,
		whenReady: state.ready
	},
	protocol: { registerSchemesAsPrivileged: vi.fn() }
}));
beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	state.lock.mockReturnValue(true);
});

test('only the first app instance reaches readiness and backend startup', async () => {
	await import('../src/initializers/initializeDesktop');
	expect(state.lock).toHaveBeenCalledOnce();
	expect(state.ready).toHaveBeenCalledOnce();
	expect(state.lock.mock.invocationCallOrder[0]).toBeLessThan(
		state.ready.mock.invocationCallOrder[0]
	);
	expect(state.on.mock.calls.map(([event]) => event)).toContain('second-instance');
});

test('a second app instance quits before readiness or any backend can start', async () => {
	state.lock.mockReturnValue(false);
	await import('../src/initializers/initializeDesktop');
	expect(state.quit).toHaveBeenCalledOnce();
	expect(state.ready).not.toHaveBeenCalled();
});
