import { expect, test, vi } from 'vitest';
import type { AuthOptions } from '../../src/lib/development-tooling/desktop-initialization/NativeAuthService.types';
import { MacDeviceApprovalError } from '../../src/lib/development-tooling/desktop-initialization/MacDeviceApprovalError';
import { NativeAuthService } from '../../src/lib/development-tooling/desktop-initialization/NativeAuthService';
import { HostedHttpAdapter } from '../../src/adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import type { NativeSessionAdapter } from '../../src/adapters/networking-security/NativeSessionAdapter';

test('Mac Google identity waits for the native device before enabling the account or approval actions', async () => {
	const actor = {
		id: 'google:fixture',
		name: 'Fixture',
		email: 'fixture@example.invalid',
		emailVerified: true
	};
	const origin = 'https://hub.example.invalid';
	const credential = { origin, principalId: actor.id, token: 'fixture' };
	const onSignIn = vi.fn();
	const status = vi.fn<NonNullable<AuthOptions['deviceApproval']>['status']>();
	status.mockResolvedValueOnce({
		configured: true,
		state: 'waiting-for-approval',
		verificationCode: '019205'
	});
	status.mockResolvedValueOnce({ configured: true, state: 'signed-in', actor });
	status.mockRejectedValueOnce(new MacDeviceApprovalError('approval-denied'));
	const deviceApproval = { status, action: vi.fn(async () => ({ requests: [] })), close: vi.fn() };
	const store = {
		read: vi.fn(async () => credential),
		clear: vi.fn()
	} as unknown as NativeSessionAdapter;
	const http = new HostedHttpAdapter({
		origin,
		credentials: () => store.read(),
		fetch: Object.assign(async () => Response.json({ actor }), { preconnect: vi.fn() })
	});
	const service = new NativeAuthService({
		origin,
		http,
		store,
		open: vi.fn(),
		onSignIn,
		deviceApproval
	});
	expect(await service.status()).toEqual({
		configured: true,
		state: 'waiting-for-approval',
		verificationCode: '019205'
	});
	expect(service.admitted).toBe(false);
	expect(onSignIn).not.toHaveBeenCalled();
	expect(() => service.deviceApproval({ action: 'list' })).toThrow(MacDeviceApprovalError);
	expect(deviceApproval.action).not.toHaveBeenCalled();
	expect((await service.status()).actor?.id).toBe(actor.id);
	expect(service.admitted).toBe(true);
	expect(onSignIn).toHaveBeenCalledWith(actor.id);
	expect(await service.deviceApproval({ action: 'list' })).toEqual({ requests: [] });
	expect(await service.status()).toEqual({
		configured: true,
		state: 'signed-out',
		approvalFailure: 'approval-denied'
	});
	expect(service.admitted).toBe(false);
});
