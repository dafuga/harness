// @harness-uid u_vvwiludcl4
import type { HostedEntityEvidenceQuery, Transport } from './HostedEvidenceService.types';
import type { EvidenceArtifactQuery } from '../../../../models/verification-evidence/DesktopEvidence.types';
import { HostedEvidenceValidator } from '../../../../validators/verification-evidence/HostedEvidenceValidator';
import {
	HostedReadService,
	type HostedReadOptions
} from '../../../../services/development-tooling/HostedReadService';
import { RemoteArtifactCacheService } from './RemoteArtifactCacheService';
import type {
	EntityEvidenceResult,
	EvidenceArtifactResult
} from '../../../../models/verification-evidence/DesktopEvidence.types';
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
	async evidence(input: HostedEntityEvidenceQuery): Promise<EntityEvidenceResult> {
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
	artifact(input: EvidenceArtifactQuery & { projectId: string }): Promise<EvidenceArtifactResult> {
		const query = { ...input };
		return this.artifacts.read({ key: this.transport.path('artifact', query), query }, () =>
			this.transport.artifact(query)
		);
	}
}
