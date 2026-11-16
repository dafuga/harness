// @harness-uid u_5nouewhdog
import type { DeployExecutor } from '../../models/development-tooling/Deployment.types';

export class CloudflareCredentialConfigurationError extends Error {
	override name = 'CloudflareCredentialConfigurationError';
}

export class CloudflareTargetAccessVerificationError extends Error {
	override name = 'CloudflareTargetAccessVerificationError';
}

export class CloudflareProductionBranchUnknownError extends Error {
	override name = 'CloudflareProductionBranchUnknownError';
}

export class CloudflareProductionBranchConflictError extends Error {
	override name = 'CloudflareProductionBranchConflictError';
}

export class CloudflareDeploymentIdentityMissingError extends Error {
	override name = 'CloudflareDeploymentIdentityMissingError';
}

export interface Options {
	execute?: DeployExecutor;
	request?: (input: string, init?: RequestInit) => Promise<Response>;
}
