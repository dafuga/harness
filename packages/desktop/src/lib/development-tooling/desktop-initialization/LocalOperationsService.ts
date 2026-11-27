// @harness-uid u_dhwgyywtay

import {
	DesktopOperationUnavailableError,
	type LocalControl,
	type LocalOperationsOptions,
	type Fields,
	type Operation
} from './LocalOperationsService.types';
import { remoteMethods } from '../../../../../remote/src/index';
import type { RemoteMethod, WireRequest } from '../../../../../remote/src/index';
import { readProjectOverview } from '$reports/lib/projects-sessions/project-overview/readProjectOverview';
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import { channels } from '../../../models/development-tooling/DesktopBridge.types';
import type { EvidenceArtifactResult as Artifact } from '../../../models/verification-evidence/DesktopEvidence.types';
import { binaryAnswer } from '../../../utils/reports-media/binaryAnswer';
import { IpcRequestValidator } from '../../../validators/development-tooling/IpcRequestValidator';
import { MacTrackerInboxService } from './MacTrackerInboxService';
import { UnexpectedOverviewFieldsError } from './UnexpectedOverviewFieldsError';
import { createHomeSnapshotReader } from './tracker-overview-publisher/createHomeSnapshotReader';
import { createHomeChatWriter } from './tracker-overview-publisher/createHomeChatWriter';

const controls: Record<string, keyof LocalControl> = {
	'remote.status': 'status',
	'remote.enable': 'enable',
	'remote.disable': 'disable',
	'remote.approvePairing': 'approvePairing',
	'remote.denyPairing': 'denyPairing',
	'remote.revokeDevice': 'revokeDevice'
};
const withInput: (keyof LocalControl)[] = ['approvePairing', 'denyPairing', 'revokeDevice'];

function assertNoFields(input: Fields) {
	if (Object.keys(input).length)
		throw new UnexpectedOverviewFieldsError('This operation takes no fields.');
}

/**
 * The one fixed overview. It takes no input, so a window cannot name a URL, a fetcher or a path:
 * any field left after the protocol epoch is refused before it is read. A Hub-configured Desktop
 * answers from the Hub; without one, it reads the local tracker.
 */
function overview(
	input: Fields,
	hubOverview?: () => Promise<OverviewSnapshot>
): Promise<OverviewSnapshot> {
	assertNoFields(input);
	return hubOverview ? hubOverview() : readProjectOverview();
}

/**
 * What the window of this computer may ask: the whole bridge and the control port, under the
 * same validation as before. The socket changed how a request arrives, not what it may do.
 */
export class LocalOperationsService {
	private readonly payloads = new IpcRequestValidator();
	private readonly tracker = new MacTrackerInboxService();
	private readonly home = createHomeSnapshotReader(process.env.HARNESS_HUB_HOME_PROVIDER_FILE);
	private readonly chat = createHomeChatWriter((input, init) => fetch(input, init));
	constructor(private readonly options: LocalOperationsOptions) {}
	methods(): RemoteMethod[] {
		return [...remoteMethods];
	}
	async handle(request: WireRequest): Promise<unknown> {
		const { method } = request,
			input: Fields = { ...request.input };
		delete input.epoch;
		if (method === 'projectOverview') return overview(input, this.options.hubOverview);
		if (method === 'homeSnapshot') {
			assertNoFields(input);
			return this.home();
		}
		if (method === 'homeChat') return this.chat(input);
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
	/** The services behind the control port validate what they are given. */
	private control(name: keyof LocalControl, input: Fields): Promise<unknown> {
		const operation = this.options.control[name] as Operation;
		return withInput.includes(name) ? operation(input) : operation();
	}
}

export type { LocalControl, LocalOperationsOptions } from './LocalOperationsService.types';
