import { expect, test, vi } from 'vitest';
import type { BrowserWindow, Dialog } from 'electron';
import { chooseProject } from '../src/lib/development-tooling/desktop-initialization/initialize-desktop/chooseProject';
import { remoteControl } from '../src/lib/development-tooling/desktop-initialization/initialize-desktop/remoteControl';

const window = {} as BrowserWindow;
const dialogOf = (result: { canceled: boolean; filePaths: string[] }) =>
	({ showOpenDialog: vi.fn(async () => result) }) as unknown as Dialog;

test('choosing a project returns the picked folder, or null when cancelled or empty', async () => {
	const picked = dialogOf({ canceled: false, filePaths: ['/work/app', '/work/other'] });
	expect(await chooseProject(window, picked)).toBe('/work/app');
	expect(picked.showOpenDialog).toHaveBeenCalledWith(window, {
		title: 'Open a Harness project',
		properties: ['openDirectory']
	});
	expect(await chooseProject(window, dialogOf({ canceled: true, filePaths: ['/x'] }))).toBeNull();
	expect(await chooseProject(window, dialogOf({ canceled: false, filePaths: [] }))).toBeNull();
});

test('each remote control calls the running host or its devices with its input', () => {
	const calls: string[] = [];
	const call = (name: string) =>
		vi.fn((input?: unknown) => {
			calls.push(`${name}:${JSON.stringify(input)}`);
			return name;
		});
	const devices = {
		approvePairing: call('approvePairing'),
		denyPairing: call('denyPairing'),
		revokeDevice: call('revokeDevice')
	};
	const host = {
		devices,
		status: call('status'),
		enable: call('enable'),
		disable: call('disable')
	};
	const control = remoteControl(host as never) as unknown as Record<
		string,
		(input?: unknown) => unknown
	>;
	expect(control.status()).toBe('status');
	expect(control.enable()).toBe('enable');
	expect(control.disable()).toBe('disable');
	expect(control.approvePairing({ id: 'a' })).toBe('approvePairing');
	expect(control.revokeDevice({ id: 'b' })).toBe('revokeDevice');
	expect(calls).toContain('approvePairing:{"id":"a"}');
	expect(calls).toContain('revokeDevice:{"id":"b"}');
	expect(control.denyPairing({ id: 'c' })).toBe('denyPairing');
});
