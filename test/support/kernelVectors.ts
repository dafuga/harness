import type { KernelVector } from './kernelVectors.types';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(
	new URL('../../crates/impact-kernel/tests/vectors.json', import.meta.url)
);

export const kernelVectors = JSON.parse(readFileSync(file, 'utf8')) as KernelVector[];

export function vectorText(vector: KernelVector): string {
	return vector.text ?? JSON.stringify(vector.request);
}

export type { KernelVector } from './kernelVectors.types';
