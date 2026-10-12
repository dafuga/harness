import { createHash } from 'node:crypto';
import type { ProjectSnapshot } from '../models/Desktop.types';
import type { HostedHttpAdapter } from '../adapters/HostedHttpAdapter';
import { RemoteProjectResponseValidator } from '../validators/RemoteProjectResponseValidator';
import { HostedReadService, type HostedReadOptions } from './HostedReadService';
export class RemoteProjectionService {
	private reads: HostedReadService;
	private validator = new RemoteProjectResponseValidator();
	private views = new Map<string, string>();
	constructor(
		private http: HostedHttpAdapter,
		private options: HostedReadOptions
	) {
		this.reads = new HostedReadService(options);
	}
	branch(projectId: string) {
		return this.views.get(projectId) ?? null;
	}
	async snapshot(input: {
		projectId: string;
		branch: string | null;
		commit: string | null;
	}): Promise<ProjectSnapshot> {
		const validate = (value: unknown) => {
			const snapshot = this.validator.snapshot(value, input.projectId);
			if (snapshot.cache && snapshot.cache.identity.sourceCommit !== snapshot.revision.commit)
				throw new Error('Hosted cache commit mismatch.');
			if (input.commit && snapshot.revision.commit !== input.commit)
				throw new Error('Hosted commit mismatch.');
			return snapshot;
		};
		const result = await this.reads.read(
			{ projectId: input.projectId, key: this.path(input.projectId, 'snapshot', input) },
			async () => {
				const value = validate(await this.http.json(this.path(input.projectId, 'snapshot', input)));
				return { value, identity: value.cache?.identity };
			},
			validate
		);
		const snapshot = result.value;
		this.views.set(input.projectId, snapshot.revision.branch);
		return cachedSnapshot(snapshot, result);
	}
	async projects() {
		const result = await this.reads.read(
			{ projectId: '$projects', key: 'projects' },
			async () => {
				const value = this.validator.projects(await this.http.json('/api/projects'));
				if (!this.options.cache) return { value };
				const identities = [];
				for (const project of value) {
					const snapshot = await this.snapshot({
						projectId: project.id,
						branch: null,
						commit: null
					});
					if (snapshot.cache?.status === 'offline')
						throw new Error('Project authority unavailable.');
					if (snapshot.cache) identities.push(snapshot.cache.identity);
				}
				const first = identities[0];
				// This is a discovery index; its profile binds every project's independent revisions.
				const identity =
					first && identities.length === value.length
						? {
								...first,
								projectId: '$projects',
								profile: createHash('sha256').update(JSON.stringify(identities)).digest('hex')
							}
						: undefined;
				return { value, identity };
			},
			(value) => this.validator.projects(value)
		);
		return result.value;
	}
	async read<T>(
		input: { projectId: string; commit: string; branch?: string | null },
		operation: string,
		validate: (value: unknown) => T,
		load?: () => Promise<unknown>
	): Promise<T> {
		const path = this.path(input.projectId, operation, input);
		const fetchValue = load ?? (() => this.http.json(path));

		const result = await this.reads.read(
			{ projectId: input.projectId, key: path },
			async () => {
				if (!this.options.cache) return { value: validate(await fetchValue()) };
				// Metadata is fetched directly: an offline nested snapshot cannot authorize this request.
				const metadata = this.validator.snapshot(
					await this.http.json(
						this.path(input.projectId, 'snapshot', {
							branch: this.branch(input.projectId),
							commit: input.commit
						})
					),
					input.projectId
				);
				if (metadata.cache && metadata.cache.identity.sourceCommit !== input.commit)
					throw new Error('Hosted cache commit mismatch.');
				if (metadata.revision.commit !== input.commit) throw new Error('Hosted commit mismatch.');
				return { value: validate(await fetchValue()), identity: metadata.cache?.identity };
			},
			validate
		);
		return result.value;
	}
	path(projectId: string, operation: string, input: object = {}): string {
		return projectionPath(projectId, operation, input);
	}
}
function projectionPath(projectId: string, operation: string, input: object = {}): string {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(projectId))
		throw new Error('Invalid hosted project.');
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(input))
		if (key !== 'projectId' && value !== null && value !== undefined) query.set(key, String(value));
	return `/api/projects/${encodeURIComponent(projectId)}${operation ? '/' + operation : ''}${query.size ? '?' + query : ''}`;
}

function cachedSnapshot(
	snapshot: ProjectSnapshot,
	result: { offline: boolean; cachedAt?: string }
): ProjectSnapshot {
	return {
		...snapshot,
		writable: false,
		...(snapshot.cache
			? {
					cache: {
						...snapshot.cache,
						status: result.offline ? 'offline' : 'fresh',
						cachedAt: result.cachedAt,
						readOnly: result.offline
					}
				}
			: {}),
		...(result.offline
			? {
					capabilities: {
						comments: false,
						agents: false,
						planning: false,
						approval: false,
						source: 'github',
						reason: 'Offline cached view is read-only.'
					}
				}
			: {})
	};
}
