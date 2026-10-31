import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureIndex, type CaptureLine } from '../../../src/core/verifyTypes';

/** Read only the actual lines produced by a normal verification command. */
export function captureLines(directory: string): CaptureLine[] {
	return readFileSync(join(directory, captureIndex), 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
}
