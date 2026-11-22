// @harness-uid u_5tr25i26at
import type {
	ProjectRunRequest,
	ProjectTaskRequest,
	RunRequest
} from '../../models/development-tooling/DesktopBridge.types';
import { DesignOptionsOnChangeError } from './DesignOptionsOnChangeError';
import { InvalidDesignOptionsError } from './InvalidDesignOptionsError';

/** Design options a Plan of a visual unit makes when it states no count of its own. */
export const defaultDesignOptions = 3;

/**
 * The design options a request asks for, refused before any work when it is not a whole number
 * from 1 to 10, or when a Change asks for any: a Change implements a design, it makes none.
 */
export function designCount(request: RunRequest | ProjectRunRequest | ProjectTaskRequest): number {
	const count = request.designOptions;
	if (count === undefined) return defaultDesignOptions;
	if (request.mode !== 'plan')
		throw new DesignOptionsOnChangeError('A Change makes no design options.');
	if (!Number.isInteger(count) || count < 1 || count > 10)
		throw new InvalidDesignOptionsError('Design options must be a whole number from 1 to 10.');
	return count;
}
