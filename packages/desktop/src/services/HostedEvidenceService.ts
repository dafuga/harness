import type { EntityEvidenceQuery, EvidenceArtifactQuery } from '../models/DesktopEvidence.types';
import { HostedEvidenceValidator } from '../validators/HostedEvidenceValidator';
import { HostedReadService, type HostedReadOptions } from './HostedReadService';
import { RemoteArtifactCacheService } from './RemoteArtifactCacheService';
type Asked = EntityEvidenceQuery & { projectId: string };
interface Transport {
	path(operation: 'evidence' | 'artifact', query: Asked): string;
	evidence(query: Asked): Promise<unknown>;
	artifact(
		query: EvidenceArtifactQuery & { projectId: string }
	): Promise<{ bytes: Uint8Array; mediaType: string; principalId: string }>;
}
export class HostedEvidenceService {
	private reads: HostedReadService;
	private artifacts: RemoteArtifactCacheService;
	private validator = new HostedEvidenceValidator();
	constructor(
		private transport: Transport,
		options: HostedReadOptions
	) {
		this.reads = new HostedReadService(options);
		this.artifacts = new RemoteArtifactCacheService(this.reads);
	}
	async evidence(input: Asked) {
		input = { ...input };
		const key = this.transport.path('evidence', input);
		const validate = (value: unknown) => this.validator.evidence(value, input);
		const result = await this.reads.read(
			{ projectId: input.projectId, key },
			async () => {
				const value = validate(await this.transport.evidence(input));
				return { value, identity: value.identity };
			},
			validate
		);
		this.artifacts.pin(result.value.identity);
		return result.value;
	}
	artifact(input: EvidenceArtifactQuery & { projectId: string }) {
		const query = { ...input };
		return this.artifacts.read({ key: this.transport.path('artifact', query), query }, () =>
			this.transport.artifact(query)
		);
	}
}
