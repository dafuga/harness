// @harness-uid u_u3ui3ii2hx
import type { TrackerChangeEvent } from '$reports/lib/projects-sessions/realtime/realtime.types';
import type { LocalClientOptions } from './LocalClientService.types';
import { hostname } from 'node:os';
import {
	RemoteFailure,
	WireFramingService,
	WireSessionService
} from '../../../../../remote/src/index';
import { homeMethods } from '../../../../../remote/src/models/networking-security/RemoteValues';
import { localTransport } from '../../../../../remote/src/index';
import type {
	RemoteConnectionEvent,
	RemoteMethod,
	WireChannel,
	WireLink
} from '../../../../../remote/src/index';
import { DesktopBridgeService } from '../../../services/development-tooling/desktop-bridge-service/DesktopBridgeService';
import { DesktopRunService } from '../../../services/agents-providers/desktop-run-service/DesktopRunService';
import { LocalOperationsService } from './LocalOperationsService';
import type { LocalOperationsOptions } from './LocalOperationsService.types';
import type { LocalSocket } from '../../../services/LocalTransportService';
import { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';
import type { CacheStatus } from '../../../models/projects-sessions/ProjectContext.types';
import type { RunEvent } from '../../../models/development-tooling/DesktopBridge.types';
/** A person may leave a dialog open, so nothing here ends an operation early. */
const patient = 6 * 60 * 60 * 1000;
const limits = {
	pendingRequests: 512,
	requestDeadlineMs: patient,
	mutationDeadlineMs: patient,
	requestBytes: localTransport.requestBytes
};
const closeCodes: Record<string, number> = { 'too-large': 4413, 'too-many-requests': 4429 };
const isEvent = (text: string) => text.startsWith('{"type":"event"');
const accountMethods = new Set(['hostedStatus', 'connectHosted', 'disconnectHosted']);
const soon = (step: () => void) => void setImmediate(step);
const words = (error: unknown) =>
	error instanceof Error && error.message ? error.message : 'The operation failed.';

function localOperations(bridge: LocalOperationsOptions['bridge'], options: LocalClientOptions) {
	const { auth, home, homeChat } = options.shared;
	return new LocalOperationsService({
		bridge,
		control: options.control,
		hubOverview: auth && (() => auth.overview()),
		home,
		homeChat
	});
}

function authorizeLocal(method: RemoteMethod, options: LocalClientOptions) {
	const requiresAccount = options.accountRequired || homeMethods.some((name) => name === method);
	if (requiresAccount && !options.shared.auth?.admitted && !accountMethods.has(method))
		throw new Error('Sign in to Harness to continue.');
}

/**
 * The client of one window: its own project session and runs, served over the loopback socket.
 * It outlives the sockets of the window, so a reload finds its project again, and it ends with
 * the window. Registry, outbox, cache and the repository locks are shared with every client.
 */
export class LocalClientService {
	readonly session: ProjectSessionService;
	readonly wire: WireSessionService;
	private readonly runs: DesktopRunService;
	private releaseAgent?: () => void;
	private readonly sockets = new Set<LocalSocket>();
	constructor(private readonly options: LocalClientOptions) {
		const { providers, renderMockups, ...stores } = options.shared;
		this.session = new ProjectSessionService(stores);
		this.runs = new DesktopRunService(
			this.session,
			providers,
			(event) => this.wire.emit('run', event),
			renderMockups
		);
		const { session, runs } = this,
			bridge = new DesktopBridgeService(session, providers, runs, options.choose).bridge((event) =>
				this.wire.emit('cache', event)
			),
			operations = localOperations(bridge, options),
			host = { id: null, name: hostname(), platform: process.platform };
		this.wire = new WireSessionService({
			role: 'local',
			limits,
			methods: () => operations.methods(),
			describe: () => ({ host, device: null, grant: null }),
			handle: (request) => {
				authorizeLocal(request.method, options);
				return operations.handle(request);
			},
			explain: (error) => ({ code: 'failed', message: words(error) })
		});
		this.releaseAgent = options.shared.remote?.onRunEvent?.((event) =>
			this.wire.emit('run', event)
		);
	}
	get ended(): boolean {
		return this.wire.ended;
	}
	/** A socket the transport admitted with a ticket of this window. */
	attach(socket: LocalSocket): void {
		if (this.wire.ended) return socket.close(4401);
		const refuse = (error: unknown) =>
			socket.close((error instanceof RemoteFailure && closeCodes[error.code]) || 4400);
		const framing = new WireFramingService({
			write: (frame) => socket.send(frame),
			defer: this.options.defer ?? soon,
			incomingBytes: localTransport.requestBytes
		});
		const link = this.wire.connect(
			(text) => {
				try {
					framing.send(text, isEvent(text));
				} catch (error) {
					refuse(error);
				}
			},
			() => socket.close(4400)
		);
		this.sockets.add(socket);
		socket.onText((frame) => this.receive({ framing, link, refuse }, frame));
		socket.onClose(() => {
			this.sockets.delete(socket);
			link.close();
			framing.reset();
		});
	}
	emit(
		channel: WireChannel,
		value: RunEvent | CacheStatus | RemoteConnectionEvent | TrackerChangeEvent
	): void {
		this.wire.emit(channel, value);
	}
	/** The runs of this window. Runs of phones and of other windows are not touched. */
	cancel(): void {
		this.runs.cancelActive();
	}
	/** The window closed: its runs are cancelled and its sockets end. */
	end(): void {
		this.releaseAgent?.();
		this.wire.end();
		this.runs.cancelActive();
		for (const socket of [...this.sockets]) socket.close(1001);
	}
	/** A frame that breaks a bound ends the socket; nothing of it reaches an operation. */
	private receive(
		connection: {
			framing: WireFramingService;
			link: WireLink;
			refuse: (error: unknown) => void;
		},
		frame: string
	): void {
		try {
			const text = connection.framing.accept(frame);
			if (text !== null) void connection.link.receive(text).catch(() => undefined);
		} catch (error) {
			connection.refuse(error);
		}
	}
}

export type { LocalClientOptions } from './LocalClientService.types';
