// @harness-uid u_n2zqdgcimk
import type { Actor, Command } from './MacDeviceApprovalService.types';
import { createHash } from 'node:crypto';
import type { NativeHostedCredential } from '../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter.types';
import type { NativeHostedStatus } from '../../../models/projects-sessions/ProjectContext.types';
import type {
	DeviceApprovalAction,
	DeviceApprovalResult
} from '../../../models/development-tooling/Environment.types';
import { publicStatus } from '../../verification-evidence/select-environment/capacitor-account-adapter/capacitorAccountCodec';
import { MacDeviceApprovalPipe } from './MacDeviceApprovalPipe';
import { MacDeviceApprovalError } from './MacDeviceApprovalError';

/** A session-specific helper owns Secure Enclave keys, with no credential in argv or the environment. */
export class MacDeviceApprovalService {
	private active?: { pipe: MacDeviceApprovalPipe; binding: string };
	private serial: Promise<unknown> = Promise.resolve();
	private generation = 0;

	constructor(private readonly binary: string) {}

	status(credential: NativeHostedCredential, actor: Actor): Promise<NativeHostedStatus> {
		return this.run(async () => {
			const pipe = await this.connect(credential, actor);
			const answer = publicStatus(
				(await this.ask(pipe, { action: 'status' })) as NativeHostedStatus
			);
			if (answer.state === 'signed-in' && answer.actor?.id !== actor.id)
				throw new MacDeviceApprovalError('account-mismatch');
			return answer;
		});
	}

	action(action: DeviceApprovalAction): Promise<DeviceApprovalResult> {
		return this.run(async () => {
			if (!this.active) throw new MacDeviceApprovalError('session-required');
			return (await this.ask(this.active.pipe, action)) as DeviceApprovalResult;
		});
	}

	close(): void {
		this.generation++;
		this.active?.pipe.close();
		this.active = undefined;
	}

	private run<T>(operation: () => Promise<T>): Promise<T> {
		const generation = this.generation;
		const result = this.serial.then(async () => {
			if (generation !== this.generation) throw new MacDeviceApprovalError('superseded');
			const value = await operation();
			if (generation !== this.generation) throw new MacDeviceApprovalError('superseded');
			return value;
		});
		this.serial = result.catch(() => undefined);
		return result;
	}

	private async connect(
		credential: NativeHostedCredential,
		actor: Actor
	): Promise<MacDeviceApprovalPipe> {
		const binding = installationBinding(credential);
		if (this.active?.binding === binding) return this.active.pipe;
		this.active?.pipe.close();
		const pipe = new MacDeviceApprovalPipe(this.binary);
		this.active = { pipe, binding };
		const value = (await this.ask(pipe, {
			action: 'start',
			origin: credential.origin,
			token: credential.token,
			actor,
			installationBinding: binding
		})) as { state?: unknown };
		if (value.state !== 'ready') {
			pipe.close();
			this.active = undefined;
			throw new MacDeviceApprovalError('failed');
		}
		return pipe;
	}

	private async ask(
		pipe: MacDeviceApprovalPipe,
		input: Command | Record<string, unknown>
	): Promise<object> {
		let response: unknown;
		try {
			response = await pipe.request(input);
		} catch (error) {
			if (this.active?.pipe === pipe) this.active = undefined;
			throw error;
		}
		const { value, error } = (response ?? {}) as { value?: object; error?: string };
		if (error) throw new MacDeviceApprovalError(error);
		if (!value || typeof value !== 'object') throw new MacDeviceApprovalError('failed');
		return value;
	}
}

/** Reopening this encrypted login keeps its installation; a newly issued session always re-enrolls. */
function installationBinding(credential: NativeHostedCredential): string {
	const hex = createHash('sha256')
		.update(
			JSON.stringify([
				'Harness Mac device approval v1',
				credential.origin,
				credential.principalId,
				credential.token
			])
		)
		.digest('hex');
	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20, 32)
	].join('-');
}
