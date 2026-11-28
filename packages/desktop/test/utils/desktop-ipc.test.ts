import { deviceApprovalInput } from '../../src/lib/development-tooling/desktop-initialization/initialize-desktop/deviceApprovalInput';
import type { Handler } from './desktop-ipc.test.types';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { bootstrapChannel } from '../../src/utils/agents-providers/desktopIpc';
import { desktopIpc } from '../../src/lib/development-tooling/desktop-initialization/initialize-desktop/desktopIpc';
import { trustedSender } from '../../src/lib/development-tooling/desktop-initialization/initialize-desktop/trustedSender';
function port() {
	const handlers = new Map<string, Handler>();
	return {
		handlers,
		handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
		removeHandler: (channel: string) => handlers.delete(channel)
	};
}
const frame = (url: string) => ({ url });
function window(url = 'harness://app/harness') {
	const mainFrame = frame(url);
	return { webContents: { mainFrame } };
}

test('the main process answers one IPC channel: the ticket of the caller, or a refusal', async () => {
	const ipc = port(),
		answer = { port: 49152, ticket: 't'.repeat(43) },
		trusted = { trusted: true },
		release = desktopIpc(ipc, (event) => (event === trusted ? answer : null));
	expect([...ipc.handlers.keys()]).toEqual([bootstrapChannel]);
	const handler = ipc.handlers.get(bootstrapChannel) as Handler;
	expect(await handler(trusted)).toEqual(answer);
	await expect(handler({ trusted: false })).rejects.toThrow('Untrusted renderer.');
	release();
	expect(ipc.handlers.size).toBe(0);
});
test('only the top frame of the app page in this window is a trusted sender', () => {
	const own = window(),
		other = window(),
		elsewhere = window('https://example.com/'),
		event = (target: ReturnType<typeof window>, senderFrame = target.webContents.mainFrame) => ({
			sender: target.webContents,
			senderFrame
		});
	expect(trustedSender(event(own) as never, own as never)).toBe(true);
	expect(trustedSender(event(other) as never, own as never)).toBe(false);
	expect(trustedSender(event(own, frame('harness://app/')) as never, own as never)).toBe(false);
	expect(trustedSender(event(elsewhere) as never, elsewhere as never)).toBe(false);
	expect(trustedSender({ sender: own.webContents, senderFrame: null } as never, own as never)).toBe(
		false
	);
});

test('the approval IPC forwards only the reviewed action, validated mailbox and comparison code', () => {
	const id = 'a'.repeat(32);
	expect(deviceApprovalInput({ action: 'list', url: 'https://fixture.invalid/' })).toEqual({
		action: 'list'
	});
	expect(deviceApprovalInput({ action: 'approve', id, code: '012345', token: 'fixture' })).toEqual({
		action: 'approve',
		id,
		code: '012345'
	});
	expect(deviceApprovalInput({ action: 'start' })).toBeUndefined();
	expect(deviceApprovalInput({ action: 'review', id: '../devices' })).toBeUndefined();
	expect(deviceApprovalInput({ action: 'approve', id, code: '12345\n' })).toBeUndefined();
});
