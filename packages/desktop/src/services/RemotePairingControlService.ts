import { RemoteInputValidator } from '../../../remote/src/index';
import type {
	HostPairingApproved,
	RemoteGrant,
	RemoteHostStatus,
	RemotePairingOffer
} from '../../../remote/src/index';
import type { RemoteHostDevice, RemoteHostState } from '../adapters/RemoteHostStoreAdapter';
import type { ProjectRegistryService } from './ProjectRegistryService';
import type { RemoteHostRuntimeService } from './RemoteHostRuntimeService';

/** What the pairing control needs of the host: the running host, and a way to keep changes. */
export interface RemoteHostAccess {
	/** Throws when remote access is off. */
	current(): { state: RemoteHostState; runtime: RemoteHostRuntimeService };
	saved(): Promise<RemoteHostStatus>;
	published(): Promise<RemoteHostStatus>;
	name(): string;
}
const unreachable = ['The relay is not connected.', 'The relay did not answer.'];

function deviceOf(
	approved: HostPairingApproved,
	grant: RemoteGrant,
	generation: number
): RemoteHostDevice {
	const { deviceId, deviceKey, deviceName: name, platform } = approved,
		approvedAt = new Date().toISOString();
	return {
		deviceId,
		deviceKey,
		name,
		platform,
		...grant,
		approvedAt,
		generation,
		lastSeenAt: null
	};
}

/**
 * Pairing and approved phones: every change here is made by the person at the computer.
 * `createPairing` opens a new one-time offer; an earlier one stops working.
 */
export class RemotePairingControlService {
	private readonly inputs = new RemoteInputValidator();
	constructor(
		private readonly host: RemoteHostAccess,
		private readonly registry: Pick<ProjectRegistryService, 'list'>
	) {}
	async createPairing(): Promise<RemotePairingOffer> {
		const { runtime } = this.host.current(),
			earlier = runtime.pairing.offer();
		if (earlier) void this.tell(runtime, { type: 'pairing-close', pairingId: earlier.pairingId });
		const { pairingId, expiresAt } = runtime.pairing.open();
		try {
			await runtime.link.command({ type: 'pairing-open', pairingId, expiresAt });
		} catch (error) {
			runtime.pairing.close();
			throw error;
		}
		const { pairing } = await this.host.published();
		if (!pairing) throw new Error('The pairing offer could not be opened.');
		return pairing;
	}
	/**
	 * Grants exactly the named local projects to exactly the phone the person was shown. The
	 * request is looked up after every wait: it must still be that phone's, or nothing is approved.
	 */
	async approvePairing(input: unknown): Promise<RemoteHostStatus> {
		const { pairingId, deviceId: shown, projects, agents } = await this.scope(input),
			{ state, runtime } = this.host.current(),
			waiting = runtime.pairing
				.requests()
				.some((item) => item.pairingId === pairingId && item.deviceId === shown);
		if (!waiting) throw new Error('This pairing request is no longer waiting.');
		const earlier = state.devices.find((device) => device.deviceId === shown),
			generation = (earlier ? earlier.generation : 0) + 1,
			grant = { projects, agents },
			terms = { hostName: this.host.name(), generation, grant, deviceId: shown };
		const approved = await runtime.pairing.approve(pairingId, terms),
			{ deviceId, sealed, challenge } = approved,
			before = state.devices;
		runtime.sessions.revoke(deviceId);
		state.devices = [
			...before.filter((device) => device.deviceId !== deviceId),
			deviceOf(approved, grant, generation)
		];
		state.revoked = state.revoked.filter((id) => id !== deviceId);
		await this.host.saved();
		const approve = { type: 'pairing-approve', pairingId, deviceId, sealed, challenge } as const;
		await runtime.link.command(approve).catch((error: unknown) => this.unapprove(before, error));
		return this.host.published();
	}
	/** The approval as given, with the projects it names: each is opened on this computer. */
	private async scope(input: unknown) {
		const approval = this.inputs.approval(input),
			known = await this.registry.list(),
			projects = known
				.filter((project) => approval.projectIds.includes(project.id))
				.map(({ id, name }) => ({ id, name }));
		if (projects.length !== approval.projectIds.length)
			throw new Error('Only projects opened on this computer can be shared.');
		return { ...approval, projects };
	}
	/**
	 * The relay did not take the approval, for one because another request replaced the approved
	 * one there. Nothing stays approved by it: the devices are again what they were before.
	 */
	private async unapprove(devices: RemoteHostDevice[], error: unknown): Promise<never> {
		this.host.current().state.devices = devices;
		await this.host.saved();
		throw error;
	}
	async denyPairing(input: unknown): Promise<RemoteHostStatus> {
		const { pairingId } = this.inputs.pairing(input),
			{ runtime } = this.host.current();
		if (runtime.pairing.deny(pairingId))
			await this.tell(runtime, { type: 'pairing-deny', pairingId });
		return this.host.published();
	}
	/** The session ends at once; the relay is told now, or as soon as it can be reached. */
	async revokeDevice(input: unknown): Promise<RemoteHostStatus> {
		const { deviceId } = this.inputs.device(input),
			{ state } = this.host.current();
		this.forget(deviceId);
		state.revoked = [...new Set([...state.revoked, deviceId])];
		await this.flush();
		return this.host.saved();
	}
	/** The owner revoked it through the hub: the relay already knows. */
	async dropped(deviceId: string): Promise<void> {
		this.forget(deviceId);
		await this.host.saved();
	}
	async seen(deviceId: string): Promise<void> {
		const device = this.host.current().state.devices.find((item) => item.deviceId === deviceId);
		if (!device) return;
		device.lastSeenAt = new Date().toISOString();
		await this.host.saved();
	}
	/** Tells the relay about revocations it has not acknowledged yet. */
	async flush(): Promise<void> {
		const { state, runtime } = this.host.current();
		for (const deviceId of [...state.revoked])
			if (await this.tell(runtime, { type: 'device-revoke', deviceId }))
				state.revoked = state.revoked.filter((id) => id !== deviceId);
	}
	/** True once the relay answered, whatever it answered; false while it cannot be reached. */
	private tell(
		runtime: RemoteHostRuntimeService,
		command: Parameters<RemoteHostRuntimeService['link']['command']>[0]
	): Promise<boolean> {
		return runtime.link.command(command).then(
			() => true,
			(error: Error) => !unreachable.includes(error.message)
		);
	}
	private forget(deviceId: string): void {
		const { state, runtime } = this.host.current();
		state.devices = state.devices.filter((device) => device.deviceId !== deviceId);
		runtime.sessions.revoke(deviceId);
	}
}
