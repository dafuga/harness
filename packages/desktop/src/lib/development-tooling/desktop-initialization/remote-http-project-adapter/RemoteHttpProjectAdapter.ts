// @harness-uid u_mieomomrtw
import { AgentHttpAdapter } from '../../../../adapters/agents-providers/AgentHttpAdapter';
import { hostedImage } from './hostedImage';
import { hostedCapabilities } from '../../../../utils/networking-security/hostedCapabilities';
import { HostedEvidenceAdapter } from './hosted-evidence-adapter/HostedEvidenceAdapter';
import { HostedEvidenceService } from './HostedEvidenceService';
import type {
	EntityEvidenceQuery,
	EvidenceArtifactQuery
} from '../../../../models/verification-evidence/DesktopEvidence.types';
import type {
	AddCommentInput,
	CommittedThread
} from '../../../../../../collaboration/src/models/planning-collaboration/Collaboration.types';
import type {
	HostedHistoryPage,
	HostedHistoryQuery,
	RemoteProjectPort,
	ProjectCapabilities
} from '../../../../models/projects-sessions/ProjectContext.types';
import type {
	EntityQuery,
	RevisionQuery,
	SourceQuery,
	ImageQuery,
	ThreadQuery
} from '../../../../models/development-tooling/DesktopBridge.types';
import {
	RemoteProjectResponseValidator,
	responseRecord
} from '../../../../validators/projects-sessions/RemoteProjectResponseValidator';
import { HostedHttpAdapter } from '../../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import { RemoteProjectionService } from './RemoteProjectionService';
import type { HostedReadOptions } from '../../../../services/development-tooling/HostedReadService';
import { InvalidHostedSourceError } from './InvalidHostedSourceError';
import { UnknownHostedImageAnchorError } from './UnknownHostedImageAnchorError';
import type {
	ProjectSnapshot,
	ThreadMessage
} from '../../../../models/development-tooling/Desktop.types';
import type { EntityDetail } from '../../../../models/development-tooling/DesktopEntity.types';

export { type NativeHostedCredential } from '../../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';

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
	async snapshot(input: RevisionQuery & { projectId: string }): Promise<ProjectSnapshot> {
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
	async entity(input: EntityQuery & { projectId: string }): Promise<EntityDetail> {
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
				throw new InvalidHostedSourceError('Invalid hosted source.');
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
	async messages(input: ThreadQuery & { projectId: string }): Promise<ThreadMessage[]> {
		return this.projections.read(input, 'messages', (value) => this.validator.messages(value));
	}
	async history(input: HostedHistoryQuery): Promise<HostedHistoryPage> {
		return this.projections.read(input, 'history', (value) => this.validator.history(value));
	}
	async capabilities(projectId: string): Promise<ProjectCapabilities> {
		return hostedCapabilities(await this.http.json(this.path(projectId, '')), projectId);
	}
	async addComment(input: AddCommentInput): Promise<CommittedThread> {
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
			throw new UnknownHostedImageAnchorError('Unknown hosted image anchor.');
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
