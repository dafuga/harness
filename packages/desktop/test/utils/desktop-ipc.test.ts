import type { Handler } from './desktop-ipc.test.types';
import { test, vi } from 'vitest';
import { IpcRequestValidator } from '../../src/validators/IpcRequestValidator';
import { expect } from '../../../../test/verificationExpect';
import { bootstrapChannel } from '../../src/utils/desktopIpc';
import { desktopIpc } from '../../src/lib/initialize-desktop/desktopIpc';
import { trustedSender } from '../../src/lib/initialize-desktop/trustedSender';
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
	const validator = new IpcRequestValidator();
	for (const projectId of ['local-project', ' project-id ']) {
		const input = { projectId, root: '/private/ignored', tasks: ['not-authorized'] };
		expect(validator.parse('project:work', input)).toEqual({ projectId });
		expect(input.projectId).toBe(projectId);
	}
	const dispatch = vi.fn();
	for (const input of [
		undefined,
		null,
		{},
		[],
		[{ projectId: 'local-project' }],
		'local-project',
		{ projectId: '' },
		{ projectId: ' \t\n' },
		{ projectId: null },
		{ projectId: 7 },
		{ projectId: false },
		{ projectId: {} }
	]) {
		expect(() => dispatch(validator.parse('project:work', input))).toThrow();
	}
	expect(dispatch).not.toHaveBeenCalled();
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
