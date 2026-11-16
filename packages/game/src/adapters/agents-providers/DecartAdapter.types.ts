// @harness-uid u_bdxtuk4rki
import type { createDecartClient } from '@decartai/sdk';

export type TokenClient = ReturnType<typeof createDecartClient>['tokens'];

export class InvalidPreviewRequestError extends Error {
	override name = 'InvalidPreviewRequestError';
}

export class ActivePreviewLeaseError extends Error {
	override name = 'ActivePreviewLeaseError';
}

export class DecartTokenCreationError extends Error {
	override name = 'DecartTokenCreationError';
}
