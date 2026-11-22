import { WireClientService } from '../../remote/src/index';
import type { RemoteGrant } from '../../remote/src/index';
import type { AgentTurn } from '../src/models/agents-providers/AgentRunner.types';
import type { RunEvent } from '../src/models/DesktopBridge.types';
import { CommentOutboxService } from '../src/services/projects-sessions/CommentOutboxService';
import { DesktopRunService } from '../src/services/agents-providers/desktop-run-service/DesktopRunService';
import { DeviceSessionService } from '../src/services/networking-security/remote-host-service/device-session-service/DeviceSessionService';
import { ProjectRegistryService } from '../src/services/projects-sessions/ProjectRegistryService';
import { ProjectSessionService } from '../src/services/projects-sessions/project-session-service/ProjectSessionService';
import { ProviderDiscoveryService } from '../src/services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import { RepositoryArbiterService } from '../src/services/projects-sessions/RepositoryArbiterService';
import { desktopBridge } from '../src/lib/development-tooling/desktop-bridge/desktopBridge';
import { fixture, git } from './run-fixture';

export function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
/** One wire client attached to a device session in memory; `lossy` drops what the host sends. */
export async function connect(session: DeviceSessionService) {
	const client = new WireClientService({
		client: { kind: 'test', name: 'fixture' },
		deadlineMs: 20000
	});
	const state = { lossy: false },
		frames: string[] = [];
	const link = session.wire.connect((text) => {
		frames.push(text);
		if (!state.lossy) client.receive(text);
	});
	const attachment = await client.bind((text) => void link.receive(text));
	return { client, link, attachment, state, frames };
}
/**
 * A real repository with a plan and a thread, a fake CLI, and what every client of one computer
 * shares: the project registry, the comment outbox, the providers and the repository arbiter.
 */
export async function remoteFixture(action: (turn: AgentTurn) => Promise<void> = async () => {}) {
	const f = await fixture(action);
	const registry = new ProjectRegistryService(),
		outbox = new CommentOutboxService(),
		arbiter = new RepositoryArbiterService();
	const project = await registry.register(f.root);
	const claude = {
		run: f.runner.run,
		discover: async () => ({
			...(await f.runner.discover()),
			id: 'claude' as const,
			imageGeneration: false
		})
	};
	const providers = new ProviderDiscoveryService({ codex: f.runner, claude });
	const shared = { registry, outbox, arbiter, providers, renderMockups: f.renderMockups };
	const full = (): RemoteGrant => ({
		projects: [{ id: project.id, name: project.name }],
		agents: true
	});
	function device(grant: RemoteGrant = full()) {
		const session = new DeviceSessionService({
			...shared,
			host: { id: 'a'.repeat(40), name: 'Fixture Mac' },
			device: { id: 'b'.repeat(40), name: 'Fixture phone' },
			grant: () => grant
		});
		return { session, connect: () => connect(session) };
	}
	/** A desktop window's own session and run service, as the main process composes them. */
	function local() {
		const session = new ProjectSessionService({ registry, outbox, arbiter }),
			events: RunEvent[] = [];
		const runs = new DesktopRunService(
			session,
			providers,
			(event) => events.push(event),
			f.renderMockups
		);
		const bridge = desktopBridge({ session, providers, runs, choose: async () => null });
		return { session, runs, events, bridge };
	}
	const revision = () => ({ branch: 'main', commit: git(f.root, 'rev-parse', 'HEAD') });
	const start = () => ({ ...f.request, projectId: project.id, revision: revision() });
	return { ...f, registry, arbiter, project, providers, device, local, revision, start };
}
