import { WireClientService } from '../../remote/src/index';
import type { RemoteGrant } from '../../remote/src/index';
import type { AgentTurn } from '../src/models/AgentRunner.types';
import type { RunEvent } from '../src/models/DesktopBridge.types';
import { CommentOutboxService } from '../src/services/CommentOutboxService';
import { DesktopRunService } from '../src/services/desktop-run-service/DesktopRunService';
import { DeviceSessionService } from '../src/services/device-session-service/DeviceSessionService';
import { ProjectRegistryService } from '../src/services/ProjectRegistryService';
import { ProjectSessionService } from '../src/services/ProjectSessionService';
import { ProviderDiscoveryService } from '../src/services/provider-discovery-service/ProviderDiscoveryService';
import { RepositoryArbiterService } from '../src/services/RepositoryArbiterService';
import { desktopBridge } from '../src/utils/desktopBridge';
import { PNG } from 'pngjs';
import { vi } from 'vitest';
import { bytes, fixture, git } from './run-fixture';

/**
 * Each image this computer generates is its own valid 2×2 PNG, so the options of one Plan never
 * repeat an image. The first is exactly the shared fixture's image; each later one is opaque and of
 * its own colour. The sequence is per fixture.
 */
function distinctImages() {
	let made = 0;
	return async () => {
		const at = made++;
		if (at === 0) return { bytes: Uint8Array.from(bytes), revisedPrompt: null };
		const png = new PNG({ width: 2, height: 2 });
		// Opaque and of a colour of its own: a visibly different picture, not a hidden pixel.
		const colour = [(at * 47) % 256, (at * 89) % 256, (at * 131) % 256, 255];
		for (let pixel = 0; pixel < 4; pixel++) png.data.set(colour, pixel * 4);
		return { bytes: PNG.sync.write(png), revisedPrompt: null };
	};
}
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
	vi.mocked(f.generator.generateImage).mockImplementation(distinctImages());
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
	const shared = { registry, outbox, arbiter, providers, generator: f.generator };
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
		const runs = new DesktopRunService(session, providers, f.generator, (event) =>
			events.push(event)
		);
		const bridge = desktopBridge({ session, providers, runs, choose: async () => null });
		return { session, runs, events, bridge };
	}
	const revision = () => ({ branch: 'main', commit: git(f.root, 'rev-parse', 'HEAD') });
	const start = () => ({ ...f.request, projectId: project.id, revision: revision() });
	return { ...f, registry, arbiter, project, providers, device, local, revision, start };
}
