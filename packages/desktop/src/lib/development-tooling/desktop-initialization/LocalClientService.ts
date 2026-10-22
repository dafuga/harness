import { hostname } from 'node:os';
import {
	RemoteFailure,
	WireFramingService,
	WireSessionService
} from '../../../../../remote/src/index';
import { localTransport } from '../../../../../remote/src/index';
import type { WireChannel, WireLink } from '../../../../../remote/src/index';
import type { ImageGenerator } from '../../../models/agents-providers/AgentRunner.types';
import type { RemoteProjectPort } from '../../../models/projects-sessions/ProjectContext.types';
import type { CommentOutboxService } from '../../../services/projects-sessions/CommentOutboxService';
import { DesktopBridgeService } from '../../../services/development-tooling/desktop-bridge-service/DesktopBridgeService';
import { DesktopRunService } from '../../../services/agents-providers/desktop-run-service/DesktopRunService';
import { LocalOperationsService } from './LocalOperationsService';
import type { LocalControl } from './LocalOperationsService';
import type { LocalSocket } from '../../../services/LocalTransportService';
import type { NativeAuthService } from './NativeAuthService';
import type { ProjectRegistryService } from '../../../services/projects-sessions/ProjectRegistryService';
import { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';
import type { ProjectionCacheService } from './projection-cache-service/ProjectionCacheService';
import type { ProviderDiscoveryService } from '../../../services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import type { RepositoryArbiterService } from '../../../services/projects-sessions/RepositoryArbiterService';

export interface LocalClientOptions {
	/** What every client of this computer shares; the session of a window is its own. */
	shared: {
		registry: ProjectRegistryService;
		outbox: CommentOutboxService;
		arbiter: RepositoryArbiterService;
		providers: ProviderDiscoveryService;
		generator: ImageGenerator;
		cache?: ProjectionCacheService;
		remote?: RemoteProjectPort;
		auth?: NativeAuthService;
	};
	choose: () => Promise<string | null>;
	control: LocalControl;
	defer?: (step: () => void) => void;
}
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
const soon = (step: () => void) => void setImmediate(step);
const words = (error: unknown) =>
	error instanceof Error && error.message ? error.message : 'The operation failed.';

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
		const { providers, generator, ...stores } = options.shared;
		this.session = new ProjectSessionService(stores);
		this.runs = new DesktopRunService(this.session, providers, generator, (event) =>
			this.wire.emit('run', event)
		);
		const { session, runs } = this,
			bridge = new DesktopBridgeService(session, providers, runs, options.choose).bridge(),
			operations = new LocalOperationsService({ bridge, control: options.control }),
			host = { id: null, name: hostname(), platform: process.platform };
		this.wire = new WireSessionService({
			role: 'local',
			limits,
			methods: () => operations.methods(),
			describe: () => ({ host, device: null, grant: null }),
			handle: (request) => operations.handle(request),
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
	emit(channel: WireChannel, value: unknown): void {
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
