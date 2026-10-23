import type { Query } from './HostedEvidenceAdapter.types';
import type { EvidenceArtifactQuery } from '../../../../../models/verification-evidence/DesktopEvidence.types';
import {
	HostedHttpAdapter,
	type RemoteHttpOptions
} from '../../../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import { hostedEvidencePath } from './hostedEvidencePath';
import { hostedResponse } from '../../../../../utils/development-tooling/hostedResponse';
import { artifactLimit } from '../../../../../utils/development-tooling/artifactMedia';
import { HostedFailureValidator } from '../../../../../validators/development-tooling/HostedFailureValidator';

/** One authenticated bounded transport for the evidence service, without cache policy. */
export class HostedEvidenceAdapter {
	private http: HostedHttpAdapter;
	constructor(options: RemoteHttpOptions | HostedHttpAdapter) {
		this.http = options instanceof HostedHttpAdapter ? options : new HostedHttpAdapter(options);
	}
	path(
		operation: 'evidence' | 'artifact',
		query: Query | (EvidenceArtifactQuery & { projectId: string })
	) {
		return hostedEvidencePath(query, operation);
	}
	async evidence(query: Query): Promise<unknown> {
		const { bytes } = await this.read('evidence', query, 16 * 1024 * 1024);
		try {
			return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
		} catch {
			throw new Error('This app does not accept the hosted evidence answer.');
		}
	}
	artifact(query: EvidenceArtifactQuery & { projectId: string }) {
		return this.read('artifact', query, artifactLimit);
	}
	private async read(operation: 'evidence' | 'artifact', query: Query, limit: number) {
		const path = this.path(operation, query);
		const credential = await this.http.authorize();
		const response = await this.http.request(path, credential, {}, true);
		try {
			return {
				bytes: await hostedResponse(response, limit),
				mediaType: response.headers.get('content-type') ?? '',
				principalId: credential.principalId
			};
		} catch (error) {
			const failure = HostedFailureValidator.classify(error);
			if (failure.category === 'offline') throw failure;
			throw error;
		}
	}
}
