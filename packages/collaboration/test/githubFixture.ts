import { createCollaboration, createGitHubRepository } from '../src/index';
import type {
	Actor,
	CollaborationRecords,
	GitHubOptions,
	SourceAdapter
} from '../src/models/Collaboration.types';
export const owner: Actor = {
	id: 'google:owner',
	email: 'owner@example.test',
	name: 'Owner',
	emailVerified: true
};
export const guest: Actor = {
	id: 'google:guest',
	email: 'guest@example.test',
	name: 'Guest',
	emailVerified: true
};
export const repository = {
	id: 101,
	owner: 'synthetic',
	name: 'private-records',
	private: true,
	installationId: 7
};
export const sourceRepository = { ...repository, id: 202, name: 'source' };
export const anchor = {
	branch: 'feature/comments',
	commit: 'a'.repeat(40),
	entityId: 'page.activity',
	version: null,
	imageSha256: null,
	state: null,
	viewport: null,
	region: null
};
export const source: SourceAdapter = {
	async resolve() {
		return { commit: anchor.commit, tree: 'b'.repeat(40) };
	},
	async tree() {
		return [];
	},
	async read() {
		return new Uint8Array();
	},
	async validateAnchor() {}
};
type Call = { path: string; method: string; body: Record<string, unknown> };
interface State {
	counter: number;
	head: string;
	public: boolean;
	missing: boolean;
	beforePatch: (() => void) | null;
	commits: Map<string, { parent: string; tree: string }>;
	trees: Map<string, string>;
	blobs: Map<string, string>;
	calls: Call[];
	scopes: Parameters<GitHubOptions['token']>[0][];
}
function next(state: State) {
	return (state.counter++).toString(16).padStart(40, '0');
}
function records(state: State): CollaborationRecords {
	const encoded = state.blobs.get(state.trees.get(state.commits.get(state.head)!.tree)!)!;
	return encoded
		? JSON.parse(atob(encoded))
		: { schemaVersion: 1, projects: [], members: [], invitations: [], threads: [] };
}
function replace(state: State, records: CollaborationRecords) {
	const blob = next(state),
		tree = next(state),
		commit = next(state);
	state.blobs.set(blob, btoa(JSON.stringify(records)));
	state.trees.set(tree, blob);
	state.commits.set(commit, { parent: state.head, tree });
	state.head = commit;
}
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function read(state: State, url: URL, path: string) {
	if (path === '') return response({ id: repository.id, private: !state.public });
	if (path.startsWith('/git/ref/') && state.missing) return response({}, 404);
	if (path.startsWith('/git/ref/'))
		return response({ ref: 'refs/heads/harness-collaboration', object: { sha: state.head } });
	if (path.startsWith('/contents/')) {
		const ref = url.searchParams.get('ref')!;
		const content = state.blobs.get(state.trees.get(state.commits.get(ref)!.tree)!);
		return content ? response({ type: 'file', encoding: 'base64', content }) : response({}, 404);
	}
	return response({ tree: { sha: state.commits.get(path.split('/').at(-1)!)!.tree } });
}
function write(state: State, call: Call) {
	const body = call.body;
	if (call.path === '/git/refs') return createRef(state, body);
	if (call.method === 'PATCH') {
		state.beforePatch?.();
		state.beforePatch = null;
		if (body.force !== false || state.commits.get(String(body.sha))!.parent !== state.head)
			return response({}, 422);
		state.head = String(body.sha);
		return response({ ref: 'refs/heads/harness-collaboration', object: { sha: state.head } });
	}
	const sha = next(state);
	if (call.path === '/git/blobs') state.blobs.set(sha, String(body.content));
	if (call.path === '/git/trees')
		state.trees.set(sha, (body.tree as Array<{ sha: string }>)[0].sha);
	if (call.path === '/git/commits')
		state.commits.set(sha, { parent: (body.parents as string[])[0], tree: String(body.tree) });
	return response({ sha });
}
export function githubFixture() {
	const state: State = {
		counter: 3,
		head: '1'.padStart(40, '0'),
		public: false,
		missing: false,
		beforePatch: null,
		commits: new Map(),
		trees: new Map(),
		blobs: new Map(),
		calls: [],
		scopes: []
	};
	state.commits.set(state.head, { parent: '', tree: '2'.padStart(40, '0') });
	state.trees.set('2'.padStart(40, '0'), '');
	const options: GitHubOptions & { ref: string; path: string } = {
		repository,
		ref: 'refs/heads/harness-collaboration',
		path: 'records/state.json',
		async token(scope) {
			state.scopes.push(scope);
			return 'test-token';
		},
		async fetch(input, init) {
			const url = new URL(String(input)),
				path = url.pathname.replace('/repos/synthetic/private-records', '');
			const call = {
				path,
				method: init?.method ?? 'GET',
				body: init?.body ? JSON.parse(String(init.body)) : {}
			};
			state.calls.push(call);
			return call.method === 'GET' ? read(state, url, path) : write(state, call);
		}
	};
	return Object.assign(state, {
		options,
		records: () => records(state),
		replace: (value: CollaborationRecords) => replace(state, value),
		revision: () => state.head
	});
}

export function collaborationFixture() {
	const remote = githubFixture();
	const clock = { value: new Date('2026-10-12T00:00:00Z') };
	const api = createCollaboration({
		repository: createGitHubRepository(remote.options),
		now: () => clock.value,
		source,
		cache: {
			async get() {
				return null;
			},
			async put() {},
			async delete() {}
		},
		async authorizeRepository(actor, repositoryId) {
			if (actor.id !== owner.id || repositoryId !== sourceRepository.id) throw new Error('Denied');
			return sourceRepository;
		}
	});
	return { api, remote, clock };
}

function createRef(state: State, body: Record<string, unknown>) {
	state.beforePatch?.();
	state.beforePatch = null;
	if (!state.missing) return response({}, 422);
	state.missing = false;
	state.head = String(body.sha);
	return response({ ref: 'refs/heads/harness-collaboration', object: { sha: state.head } });
}
