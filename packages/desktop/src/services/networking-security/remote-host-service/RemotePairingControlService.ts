// @harness-uid u_kl5coeje2e
import { PairingOfferCreationError } from './PairingOfferCreationError';
import { PairingOfferUnsupportedError } from './PairingOfferUnsupportedError';
import { PairingRequestNotWaitingError } from './PairingRequestNotWaitingError';
import { ProjectNotOpenedError } from './ProjectNotOpenedError';
import type { RemoteHostAccess } from './RemotePairingControlService.types';
import { RemoteInputValidator, offerEnvironment } from '../../../../../remote/src/index';
import type {
	HostPairingApproved,
	RemoteApprovalInput,
	RemoteGrant,
	RemoteHostStatus,
	RemotePairingOffer,
	RemotePairingRequest
} from '../../../../../remote/src/index';
import type { RemoteHostDevice } from '../../../adapters/networking-security/RemoteHostStoreAdapter';
import type { ProjectRegistryService } from '../../projects-sessions/ProjectRegistryService';
import type { RemoteHostRuntimeService } from './RemoteHostRuntimeService';
const unreachable = ['The relay is not connected.', 'The relay did not answer.'];
const replaced = 'A newer pairing code replaced this one.';

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

/** The approval as given, with the projects it names: each is opened on this computer. */
async function scoped(
	registry: Pick<ProjectRegistryService, 'list'>,
	approval: RemoteApprovalInput
) {
	const known = await registry.list(),
		projects = known
			.filter((project) => approval.projectIds.includes(project.id))
			.map(({ id, name }) => ({ id, name }));
	if (projects.length !== approval.projectIds.length)
		throw new ProjectNotOpenedError('Only projects opened on this computer can be shared.');
	return { ...approval, projects };
}

/** Opens an offer at both ends and only withdraws its own on failure. */
async function openedOffer(runtime: RemoteHostRuntimeService): Promise<string> {
	const { pairingId, expiresAt } = runtime.pairing.open();
	try {
		await runtime.link.command({ type: 'pairing-open', pairingId, expiresAt });
	} catch (error) {
		if (runtime.pairing.offer()?.pairingId === pairingId) runtime.pairing.closeOffer();
		throw error;
	}
	return pairingId;
}

async function approveDevice(
	host: RemoteHostAccess,
	runtime: RemoteHostRuntimeService,
	{ pairingId, deviceId }: Pick<RemotePairingRequest, 'pairingId' | 'deviceId'>,
	{ projects, agents, comments }: RemoteGrant
): Promise<RemoteHostStatus> {
	const { state } = host.current();
	const waiting = runtime.pairing
		.requests()
		.some((item) => item.pairingId === pairingId && item.deviceId === deviceId);
	if (!waiting)
		throw new PairingRequestNotWaitingError('This pairing request is no longer waiting.');
	const earlier = state.devices.find((device) => device.deviceId === deviceId);
	const generation = (earlier?.generation ?? 0) + 1;
	const grant = { projects, agents, ...(comments === undefined ? {} : { comments }) };
	const terms = { hostName: host.name(), generation, grant, deviceId };
	const approved = await runtime.pairing.approve(pairingId, terms);
	if (host.current().runtime !== runtime)
		throw new PairingRequestNotWaitingError('This connection has ended.');
	const device = deviceOf(approved, grant, generation);
	runtime.sessions.revoke(deviceId);
	state.devices = [...state.devices.filter((item) => item.deviceId !== deviceId), device];
	state.revoked = state.revoked.filter((id) => id !== deviceId);
	const { sealed, challenge } = approved;
	try {
		await host.saved();
		await runtime.link.command({
			type: 'pairing-approve',
			pairingId,
			deviceId,
			sealed,
			challenge
		});
	} catch (error) {
		if (state.devices.includes(device)) {
			state.devices = state.devices.filter((item) => item !== device);
			if (earlier) state.devices.push(earlier);
			await host.saved();
		}
		throw error;
	}
	return host.published();
}

/** Grants and revokes device access to local projects. */
export class RemotePairingControlService {
	private readonly inputs = new RemoteInputValidator();
	constructor(
		private readonly host: RemoteHostAccess,
		private readonly registry: Pick<ProjectRegistryService, 'list'>
	) {}
	async createPairing(): Promise<RemotePairingOffer> {
		const { runtime, state } = this.host.current();
		if (state.ownerId)
			throw new PairingOfferUnsupportedError('Use your Google account to connect.');
		const earlier = runtime.pairing.offer();
		if (!offerEnvironment(state.origin ?? ''))
			throw new PairingOfferUnsupportedError(
				'The relay of this computer cannot be shown to a phone as a QR code.'
			);
		if (earlier) void this.tell(runtime, { type: 'pairing-close', pairingId: earlier.pairingId });
		const pairingId = await openedOffer(runtime);
		const { pairing } = await this.host.published();
		if (pairing?.pairingId === pairingId) return pairing;
		throw new PairingOfferCreationError(
			runtime.pairing.offer() ? replaced : 'The pairing offer could not be opened.'
		);
	}
	/** Withdraws the open offer and whoever asked with it: neither can be used any more. */
	async closePairing(): Promise<RemoteHostStatus> {
		const { runtime } = this.host.current(),
			open = runtime.pairing.offer();
		runtime.pairing.closeOffer();
		if (open) await this.tell(runtime, { type: 'pairing-close', pairingId: open.pairingId });
		return this.host.published();
	}
	async approvePairing(input: unknown): Promise<RemoteHostStatus> {
		const approval = await scoped(this.registry, this.inputs.approval(input));
		const { runtime, state } = this.host.current();
		if (state.ownerId)
			throw new PairingRequestNotWaitingError('This computer uses Google sign-in.');
		return approveDevice(this.host, runtime, approval, approval);
	}

	/** Only the relay's verified account frame can reach this path. */
	async approveAccount(runtime: RemoteHostRuntimeService, request: RemotePairingRequest) {
		const projects = (await this.registry.list()).map(({ id, name }) => ({ id, name }));
		if (this.host.current().runtime !== runtime) return;
		await approveDevice(this.host, runtime, request, { projects, comments: false, agents: false });
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

export type { RemoteHostAccess } from './RemotePairingControlService.types';
