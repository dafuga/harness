import type { Environment } from './recordCapture.types';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureIndex, type CaptureLine } from '../../../core/verification-evidence/verifyTypes';

/** True when the run asked for evidence: `harness verify` always does, ordinary runs opt in. */
export function evidenceRequested(env: Environment = process.env): boolean {
	return Boolean(env.HARNESS_EVIDENCE_DIR) && env.TAKE_SCREENSHOT === '1';
}

/**
 * Writes one capture and its index line into the evidence directory. It does nothing, and
 * returns false, when no evidence was requested.
 */
export function recordCapture(
	line: CaptureLine,
	bytes: Uint8Array | string,
	env: Environment = process.env
): boolean {
	const directory = env.HARNESS_EVIDENCE_DIR;
	if (!directory || !evidenceRequested(env)) return false;
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, line.file), bytes);
	appendFileSync(join(directory, captureIndex), `${JSON.stringify(line)}\n`);
	return true;
}
