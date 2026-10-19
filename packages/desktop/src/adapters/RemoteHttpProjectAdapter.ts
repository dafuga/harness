import { AgentHttpAdapter } from './AgentHttpAdapter';
import { hostedImage } from '../utils/hostedImage';
import { hostedCapabilities } from '../utils/hostedCapabilities';
import { HostedEvidenceAdapter } from './HostedEvidenceAdapter';
import { HostedEvidenceService } from '../services/HostedEvidenceService';
import type { EntityEvidenceQuery, EvidenceArtifactQuery } from '../models/DesktopEvidence.types';
import type { AddCommentInput } from '../../../collaboration/src/models/Collaboration.types';
import type { RemoteProjectPort, ProjectCapabilities } from '../models/ProjectContext.types';
import type {
	EntityQuery,
	SourceQuery,
	ImageQuery,
	ThreadQuery
} from '../models/DesktopBridge.types';
import {
	RemoteProjectResponseValidator,
	responseRecord
} from '../validators/RemoteProjectResponseValidator';
import { HostedHttpAdapter } from './HostedHttpAdapter';
import { RemoteProjectionService } from '../services/RemoteProjectionService';
import type { HostedReadOptions } from '../services/HostedReadService';

export type { NativeHostedCredential } from './HostedHttpAdapter';
export class RemoteHttpProjectAdapter implements RemoteProjectPort {
	private http: HostedHttpAdapter;
	private agents: AgentHttpAdapter;
	private projections: RemoteProjectionService;
	private recorded: HostedEvidenceService;
	private validator = new RemoteProjectResponseValidator();
	constructor(private options: HostedReadOptions) {
		let denied = 0;
		const authorityOptions = {
			...options,
			authorityVersion: () => (options.authorityVersion?.() ?? 0) + denied
		};
		this.http = new HostedHttpAdapter({
			...authorityOptions,
			onDenied: async (principal, project) => {
				denied++;
				options.onCacheStatus?.({
					projectId: project ?? '$projects',
					status: 'denied'
				});
				await options.cache?.purge(principal, project);
			}
		});
		this.agents = agentPort(this.http);
		this.projections = new RemoteProjectionService(this.http, authorityOptions);
		this.recorded = new HostedEvidenceService(
			new HostedEvidenceAdapter(this.http),
			authorityOptions
		);
	}
	evidence = (input: EntityEvidenceQuery & { projectId: string }) => this.recorded.evidence(input);
	artifact = (input: EvidenceArtifactQuery & { projectId: string }) =>
		this.recorded.artifact(input);
	agent(method: string, input: unknown, projectId: string) {
		return this.agents.call(method, input, projectId);
	}
	onRunEvent(listener: Parameters<AgentHttpAdapter['listen']>[0]) {
		return this.agents.listen(listener);
	}
	async available() {
		return Boolean(await this.options.credentials());
	}
	listProjects = () => this.projections.projects();
	async snapshot(input: { projectId: string; branch: string | null; commit: string | null }) {
		const snapshot = await this.projections.snapshot(input);
		if (snapshot.cache?.status === 'offline') return snapshot;
		const capabilities = await this.capabilities(input.projectId);
		const fresh = {
			...snapshot,
			capabilities,
			writable: !input.commit && snapshot.revision.atTip && capabilities.agents
		};
		this.agents.shown(fresh, input);
		return fresh;
	}
	async entity(input: EntityQuery & { projectId: string }) {
		return this.projections.read(
			{ ...input, branch: this.projections.branch(input.projectId) },
			'entity',
			(value) => this.validator.entity(value, input.entityId)
		);
	}
	async source(input: SourceQuery & { projectId: string }) {
		return this.projections.read(input, 'source', (value) => {
			const source = responseRecord(value);
			if (source.path !== input.path || typeof source.text !== 'string')
				throw new Error('Invalid hosted source.');
			return { path: input.path, text: source.text };
		});
	}
	async image(input: ImageQuery & { projectId: string }) {
		const validate = (value: unknown) => hostedImage(value, input.sha256);
		const encoded = await this.projections.read(
			input,
			'image',
			(value) => {
				validate(value);
				return value as string;
			},
			async () => {
				const credential = await this.http.authorize();
				await this.imageAnchor(input);
				const response = await this.http.request(
					this.path(input.projectId, 'image', input),
					credential
				);
				return Buffer.from(await response.arrayBuffer()).toString('base64');
			}
		);
		return validate(encoded);
	}
	async messages(input: ThreadQuery & { projectId: string }) {
		return this.projections.read(input, 'messages', (value) => this.validator.messages(value));
	}
	async history(input: EntityQuery & { projectId: string; page: number; branch?: string }) {
		return this.projections.read(input, 'history', (value) => this.validator.history(value));
	}
	async capabilities(projectId: string): Promise<ProjectCapabilities> {
		return hostedCapabilities(await this.http.json(this.path(projectId, '')), projectId);
	}
	async addComment(input: AddCommentInput) {
		const credential = await this.http.authorize();
		const response = await this.http.request(this.path(input.projectId, 'comments'), credential, {
			method: 'POST',
			body: JSON.stringify(input)
		});
		return this.validator.comment(await response.json(), input, credential.principalId);
	}
	private async imageAnchor(input: ImageQuery & { projectId: string }): Promise<void> {
		const entity = await this.entity(input);
		if (
			!entity.versions
				.find((version) => version.version === input.version)
				?.images.some((image) => image.sha256 === input.sha256)
		)
			throw new Error('Unknown hosted image anchor.');
	}
	private path = (projectId: string, operation: string, input: object = {}) =>
		this.projections.path(projectId, operation, input);
}

function agentPort(http: HostedHttpAdapter) {
	return new AgentHttpAdapter(async (projectId, body) => {
		const credential = await http.authorize();
		const response = await http.request(
			`/api/projects/${encodeURIComponent(projectId)}/agent`,
			credential,
			{ method: 'POST', body: JSON.stringify(body) }
		);
		return response.json();
	});
}
