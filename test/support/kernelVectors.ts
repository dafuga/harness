import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RuntimeResponse } from '../../src/core/runtimeTypes';

export interface KernelVector {
	name: string;
	/** A structured request, sent through every runtime. */
	request?: unknown;
	/** Raw request text, for transports that receive bytes. */
	text?: string;
	response: RuntimeResponse;
}

const file = fileURLToPath(
	new URL('../../crates/impact-kernel/tests/vectors.json', import.meta.url)
);

export const kernelVectors = JSON.parse(readFileSync(file, 'utf8')) as KernelVector[];

export function vectorText(vector: KernelVector): string {
	return vector.text ?? JSON.stringify(vector.request);
}
