import { createHash } from 'node:crypto';
import { nativeImageFixture } from '../tests/e2e/native-image-fixture';
export const remoteImage = nativeImageFixture();
export const remoteImageHash = createHash('sha256').update(remoteImage).digest('hex');
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectionCacheService } from '../src/services/ProjectionCacheService';
import { RemoteHttpProjectAdapter } from '../src/adapters/RemoteHttpProjectAdapter';
export async function remoteCacheFixture() {
	const root = await mkdtemp(join(tmpdir(), 'hosted-cache-'));
	const state = {
		principal: 'alice',
		actor: 'alice',
		status: 200,
		notes: 'c'.repeat(40),
		collaboration: '1'.repeat(40) as string | undefined,
		text: 'first',
		malformed: false
	};
	const identity = () => ({
		...(state.collaboration === undefined ? {} : { collaborationRevision: state.collaboration }),
		principalId: state.actor,
		projectId: 'p',
		repositoryId: 1,
		requestedRef: 'main',
		sourceCommit: 'a'.repeat(40),
		sourceTree: 'b'.repeat(40),
		notesRef: 'notes',
		notesRevision: state.notes,
		evidenceRef: 'evidence',
		evidenceRevision: 'd'.repeat(40),
		historyIndexRevision: 'e'.repeat(40),
		artifactHash: null,
		profile: null
	});
	const server = serverFor(state, identity);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address() as { port: number };
	const origin = `http://127.0.0.1:${address.port}`;
	const cache = new ProjectionCacheService(join(root, 'cache'));
	const options = {
		origin,
		cache,
		credentials: async () => ({ origin, principalId: state.principal, token: 'fixture' })
	};
	const close = () => new Promise<void>((resolve) => server.close(() => resolve()));
	return {
		root,
		state,
		cache,
		options,
		adapter: new RemoteHttpProjectAdapter(options),
		close,
		cleanup: async () => {
			await close();
			await rm(root, { recursive: true, force: true });
		}
	};
}
function serverFor(
	state: { actor: string; status: number; text: string; malformed: boolean },
	identity: () => unknown
) {
	return createServer((request, response) => {
		response.setHeader('content-type', 'application/json');
		if (request.url === '/api/auth/status')
			return response.end(JSON.stringify(actorStatus(state.actor)));
		response.statusCode = state.status;
		const url = new URL(request.url!, 'http://localhost');
		if (url.pathname.endsWith('/image'))
			return response.end(state.malformed ? Buffer.from('invalid') : remoteImage);
		let value: unknown = { id: 'p', name: 'Project', role: 'owner' };
		if (url.pathname === '/api/projects') value = [value];
		if (url.pathname.endsWith('/snapshot'))
			value = {
				project: { id: 'p', name: 'Project' },
				revision: { commit: 'a'.repeat(40), branch: 'main', writable: false },
				entities: [],
				branches: [],
				commits: [],
				cache: { identity: identity(), status: 'fresh', publication: 'remote' }
			};
		if (url.pathname.endsWith('/entity'))
			value = {
				id: 'entity',
				versions: [{ version: 'v001', images: [{ sha256: remoteImageHash }] }],
				sources: [],
				threads: [],
				title: state.text
			};
		if (url.pathname.endsWith('/source')) value = { path: 'src/a.ts', text: state.text };
		if (url.pathname.endsWith('/history'))
			value = { entries: [{ id: 'history', title: state.text }], complete: true, nextPage: null };
		if (url.pathname.endsWith('/messages')) value = [{ id: 'message', text: state.text }];
		response.end(serialized(value, state.malformed));
	});
}

function serialized(value: unknown, malformed: boolean) {
	return JSON.stringify(malformed ? { invalid: true } : value);
}

function actorStatus(id: string) {
	return { actor: id ? { id, emailVerified: true } : null };
}
