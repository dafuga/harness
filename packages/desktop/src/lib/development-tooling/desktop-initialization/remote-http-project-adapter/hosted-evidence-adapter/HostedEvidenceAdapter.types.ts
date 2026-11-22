// @harness-uid u_3gvi5wxxbc
import type { EntityEvidenceQuery } from '../../../../../models/verification-evidence/DesktopEvidence.types';

export type Query = EntityEvidenceQuery & { projectId: string };

export class InvalidHostedEvidenceAnswerError extends Error {
	override name = 'InvalidHostedEvidenceAnswerError';
}
