import { WireSessionService } from "../../../../remote/src/index";
import type { RemoteGrant } from "../../../../remote/src/index";
import { remoteFailureText } from "./remoteFailureText";
import { ClientProjectsService } from "../ClientProjectsService";
import type { ClientProjectsOptions } from "../ClientProjectsService";
import { DeviceOperationsService } from "../device-operations-service/DeviceOperationsService";

export interface DeviceSessionOptions extends Omit<ClientProjectsOptions, 'emit'> {
	host: { id: string; name: string };
	device: { id: string; name: string };
	grant: () => RemoteGrant;
	epoch?: string;
	/** Whether the screen is locked, once the computer knows; undefined until then. */
	locked?: () => boolean | undefined;
}

function hostOf(host: { id: string; name: string }, locked: boolean | undefined) {
	const known = locked === undefined ? {} : { locked };
	return { ...host, platform: process.platform, ...known };
}

/**
 * Everything one approved phone has on this computer: its own project sessions, its runs, its
 * events and its remembered answers. It outlives the phone's connections and ends on revocation.
 */
export class DeviceSessionService {
	readonly wire: WireSessionService;
	private readonly projects: ClientProjectsService;
	constructor(options: DeviceSessionOptions) {
		const { host, device, grant, epoch, locked, ...shared } = options,
			{ providers, arbiter } = shared;
		const projects = new ClientProjectsService({
			...shared,
			emit: (event) => this.wire.emit('run', event)
		});
		const operations = new DeviceOperationsService({ projects, providers, arbiter, grant });
		this.projects = projects;
		this.wire = new WireSessionService({
			role: 'device',
			epoch,
			authority: true,
			methods: () => operations.methods(),
			describe: () => ({ host: hostOf(host, locked?.()), device, grant: grant() }),
			handle: (request) => operations.handle(request),
			explain: (error) => remoteFailureText(error, projects.roots)
		});
	}
	/** The phone's runs are cancelled, and no answer or event reaches it any more. */
	end(): void {
		this.wire.end();
		this.projects.end();
	}
}
