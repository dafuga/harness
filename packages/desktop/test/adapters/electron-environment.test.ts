import { expect, test, vi } from 'vitest';
import { ElectronEnvironmentAdapter } from '../../src/adapters/ElectronEnvironmentAdapter';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';

const harness = { snapshot: vi.fn() } as unknown as DesktopBridge;

test('the desktop app keeps the preload bridge as it is and may add folders', () => {
	const environment = new ElectronEnvironmentAdapter({ host: { harness } }).connect();
	expect(environment).toEqual({ kind: 'electron', bridge: harness, local: true, host: undefined });
});

test('a control port that lacks an operation is not offered at all', () => {
	const harnessRemote = { status: vi.fn(), enable: vi.fn(), onStatus: vi.fn() };
	const environment = new ElectronEnvironmentAdapter({ host: { harness, harnessRemote } });
	expect(environment.connect().host).toBeUndefined();
});
