import { remoteMethods } from '../../../remote/src/index';
import type { RemoteDesktopControl, RemoteMethod, WireRequest } from '../../../remote/src/index';
import { channels } from '../models/DesktopBridge.types';
import type { DesktopBridge } from '../models/DesktopBridge.types';
import type { EvidenceArtifactResult as Artifact } from '../models/DesktopEvidence.types';
import { binaryAnswer } from '../utils/binaryAnswer';
import { IpcRequestValidator } from '../validators/IpcRequestValidator';

export type LocalControl = Omit<RemoteDesktopControl, 'onStatus'>;
export interface LocalOperationsOptions {
	bridge: Omit<DesktopBridge, 'onRunEvent'>;
	control: LocalControl;
}
type Fields = Record<string, unknown>;
type Operation = (input?: unknown) => Promise<unknown>;
const controls: Record<string, keyof LocalControl> = {
	'remote.status': 'status',
	'remote.enable': 'enable',
	'remote.disable': 'disable',
	'remote.createPairing': 'createPairing',
	'remote.closePairing': 'closePairing',
	'remote.approvePairing': 'approvePairing',
	'remote.denyPairing': 'denyPairing',
	'remote.revokeDevice': 'revokeDevice'
};
const withInput: (keyof LocalControl)[] = ['approvePairing', 'denyPairing', 'revokeDevice'];

/**
 * What the window of this computer may ask: the whole bridge and the control port, under the
 * same validation as before. The socket changed how a request arrives, not what it may do.
 */
export class LocalOperationsService {
	private readonly payloads = new IpcRequestValidator();
	constructor(private readonly options: LocalOperationsOptions) {}
	methods(): RemoteMethod[] {
		return [...remoteMethods];
	}
	async handle(request: WireRequest): Promise<unknown> {
		const { method } = request,
			input: Fields = { ...request.input };
		delete input.epoch;
		if (Object.hasOwn(controls, method)) return this.control(controls[method], input);
		const payload = this.payloads.parse(channels[method as keyof typeof channels], input),
			operation = (this.options.bridge as Fields)[method];
		if (typeof operation !== 'function') throw new Error('Desktop operation unavailable.');
		const value = await (operation as Operation)(payload);
		if (method === 'artifact')
			return binaryAnswer((value as Artifact).bytes, (value as Artifact).mediaType);
		return method === 'image' ? binaryAnswer(value as Uint8Array) : value;
	}
	/** The services behind the control port validate what they are given. */
	private control(name: keyof LocalControl, input: Fields): Promise<unknown> {
		const operation = this.options.control[name] as Operation;
		return withInput.includes(name) ? operation(input) : operation();
	}
}
