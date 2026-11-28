// @harness-uid u_dhwgyywtay

import {
	DesktopOperationUnavailableError,
	type LocalControl,
	type LocalOperationsOptions,
	type Fields,
	type Operation
} from './LocalOperationsService.types';
import { remoteMethods } from '../../../../../remote/src/index';
import { homeMethods } from '../../../../../remote/src/models/networking-security/RemoteValues';
import type { RemoteMethod, WireRequest } from '../../../../../remote/src/index';
import { readProjectOverview } from '$reports/lib/projects-sessions/project-overview/readProjectOverview';
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import { channels } from '../../../models/development-tooling/DesktopBridge.types';
import type { EvidenceArtifactResult as Artifact } from '../../../models/verification-evidence/DesktopEvidence.types';
import { binaryAnswer } from '../../../utils/reports-media/binaryAnswer';
import { IpcRequestValidator } from '../../../validators/development-tooling/IpcRequestValidator';
import { MacTrackerInboxService } from './MacTrackerInboxService';
import { UnexpectedOverviewFieldsError } from './UnexpectedOverviewFieldsError';
const controls: Record<string, keyof LocalControl> = {
	'remote.status': 'status',
	'remote.enable': 'enable',
	'remote.disable': 'disable',
	'remote.approvePairing': 'approvePairing',
	'remote.denyPairing': 'denyPairing',
	'remote.revokeDevice': 'revokeDevice'
};
const withInput: (keyof LocalControl)[] = ['approvePairing', 'denyPairing', 'revokeDevice'];

/**
 * The one fixed overview. It takes no input, so a window cannot name a URL, a fetcher or a path:
 * any field left after the protocol epoch is refused before it is read. A Hub-configured Desktop
 * answers from the Hub; without one, it reads the local tracker.
 */
function overview(
	input: Fields,
	hubOverview?: () => Promise<OverviewSnapshot>
): Promise<OverviewSnapshot> {
	if (Object.keys(input).length)
		throw new UnexpectedOverviewFieldsError('This operation takes no fields.');
	return hubOverview ? hubOverview() : readProjectOverview();
}

/**
 * What the window of this computer may ask: the whole bridge and the control port, under the
 * same validation as before. The socket changed how a request arrives, not what it may do.
 */
export class LocalOperationsService {
	private readonly payloads = new IpcRequestValidator();
	private readonly tracker = new MacTrackerInboxService();
	constructor(private readonly options: LocalOperationsOptions) {}
	methods(): RemoteMethod[] {
		return [...remoteMethods];
	}
	async handle(request: WireRequest): Promise<unknown> {
		const { method } = request,
			input: Fields = { ...request.input };
		delete input.epoch;
		if (method === 'projectOverview') return overview(input, this.options.hubOverview);
		if (method === 'outgoingDrafts') {
			if (!this.options.outgoingDrafts)
				throw new DesktopOperationUnavailableError('Outgoing drafts are unavailable.');
			return this.options.outgoingDrafts(input);
		}
		if (homeMethods.some((name) => name === method)) return this.home(method, input);
		if (method === 'trackerInboxRead') return this.tracker.read(input);
		if (method === 'trackerInboxWrite') return this.tracker.write(input);
		if (Object.hasOwn(controls, method)) return this.control(controls[method], input);
		const payload = this.payloads.parse(channels[method as keyof typeof channels], input),
			operation = (this.options.bridge as Fields)[method];
		if (typeof operation !== 'function')
			throw new DesktopOperationUnavailableError('Desktop operation unavailable.');
		const value = await (operation as Operation)(payload);
		if (method === 'artifact')
			return binaryAnswer((value as Artifact).bytes, (value as Artifact).mediaType);
		return method === 'image' ? binaryAnswer(value as Uint8Array) : value;
	}
	private home(method: RemoteMethod, input: Fields) {
		if (method === 'homeChat' && this.options.homeChat) return this.options.homeChat(input);
		if (method === 'homeSnapshot' && this.options.home && !Object.keys(input).length)
			return this.options.home();
		throw new DesktopOperationUnavailableError('Desktop Home operation unavailable.');
	}
	/** The services behind the control port validate what they are given. */
	private control(name: keyof LocalControl, input: Fields): Promise<unknown> {
		const operation = this.options.control[name] as Operation;
		return withInput.includes(name) ? operation(input) : operation();
	}
}

export type { LocalControl, LocalOperationsOptions } from './LocalOperationsService.types';
