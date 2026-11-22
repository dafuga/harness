// @harness-uid u_srtmrphmgz
import type { VerifyConfig } from '../../../core/verification-evidence/verifyTypes';
import type { VerifyOptions } from './runVerify.types';

/** Artifact retention needs a full commit run: an entity or Lite run never exports one. */
export function partialRetention(options: VerifyOptions): boolean {
	return (
		options.retainArtifact !== undefined && (Boolean(options.entity) || options.profile === 'lite')
	);
}

export function requiresPerformance(options: VerifyOptions, config: VerifyConfig): boolean {
	return options.requirePerformance === true || config.performanceRequired === 1;
}
