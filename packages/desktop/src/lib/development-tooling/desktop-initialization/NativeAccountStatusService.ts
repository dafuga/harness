// @harness-uid u_fnvtwr6rqr
import { MacDeviceApprovalError } from './MacDeviceApprovalError';
import type { AuthOptions } from './NativeAuthService.types';
import type { StatusOptions } from './NativeAccountStatusService.types';
import type { NativeHostedCredential } from '../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import type { NativeHostedStatus } from '../../../models/projects-sessions/ProjectContext.types';
import { HostedFailureValidator } from '../../../validators/development-tooling/HostedFailureValidator';
import {
	RemoteProjectResponseValidator,
	responseRecord
} from '../../../validators/projects-sessions/RemoteProjectResponseValidator';

/** Rechecks a device's Google identity without confusing temporary failure with revocation. */
export class NativeAccountStatusService {
	constructor(private options: StatusOptions) {}
	async read(credential: NativeHostedCredential): Promise<NativeHostedStatus> {
		try {
			const value = await (await this.options.http.request('/api/auth/status', credential)).json();
			try {
				new RemoteProjectResponseValidator().actor(value, credential.principalId);
			} catch {
				throw new HostedFailureValidator('denied', 401);
			}
			const actor = responseRecord(responseRecord(value).actor);
			return {
				configured: true,
				state: 'signed-in',
				actor: { id: credential.principalId, name: String(actor.name), email: String(actor.email) }
			};
		} catch (cause) {
			if (!(cause instanceof HostedFailureValidator) || cause.category !== 'denied') throw cause;
			this.options.onDisconnect?.();
			await this.options.store.clear();
			await this.options.clearCache?.();
			return { configured: true, state: 'signed-out' };
		}
	}
}

export async function admitMacDevice(
	status: NativeHostedStatus,
	options: Pick<AuthOptions, 'deviceApproval' | 'store'>
): Promise<NativeHostedStatus> {
	const deviceApproval = options.deviceApproval;
	if (!deviceApproval) return status;
	if (status.state === 'signed-out') deviceApproval.close();
	if (status.state !== 'signed-in' || !status.actor) return status;
	const credential = await options.store.read();
	if (!credential || credential.principalId !== status.actor.id)
		return { configured: true, state: 'signed-out' };
	try {
		return await deviceApproval.status(credential, status.actor);
	} catch (error) {
		if (
			error instanceof MacDeviceApprovalError &&
			(error.code === 'approval-denied' || error.code === 'approval-expired')
		)
			return { configured: true, state: 'signed-out', approvalFailure: error.code };
		throw error;
	}
}
