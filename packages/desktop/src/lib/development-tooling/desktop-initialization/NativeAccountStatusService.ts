import type {
	HostedHttpAdapter,
	NativeHostedCredential
} from '../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import type { NativeSessionAdapter } from '../../../adapters/networking-security/NativeSessionAdapter';
import type { NativeHostedStatus } from '../../../models/projects-sessions/ProjectContext.types';
import { HostedFailureValidator } from '../../../validators/development-tooling/HostedFailureValidator';
import {
	RemoteProjectResponseValidator,
	responseRecord
} from '../../../validators/projects-sessions/RemoteProjectResponseValidator';

interface StatusOptions {
	http: HostedHttpAdapter;
	store: Pick<NativeSessionAdapter, 'clear'>;
	clearCache?: () => Promise<void>;
	onDisconnect?: () => void;
}

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
