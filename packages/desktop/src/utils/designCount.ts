import type { ProjectRunRequest, RunRequest } from '../models/DesktopBridge.types';

/** Design options a Plan of a visual unit makes when it states no count of its own. */
export const defaultDesignOptions = 3;

/**
 * The design options a request asks for, refused before any work when it is not a whole number
 * from 1 to 10, or when a Change asks for any: a Change implements a design, it makes none.
 */
export function designCount(request: RunRequest | ProjectRunRequest): number {
	const count = request.designOptions;
	if (count === undefined) return defaultDesignOptions;
	if (request.mode !== 'plan') throw new Error('A Change makes no design options.');
	if (!Number.isInteger(count) || count < 1 || count > 10)
		throw new Error('Design options must be a whole number from 1 to 10.');
	return count;
}
