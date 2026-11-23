import type { Step } from './workflow.development-tooling-loop-lifecycle-list-open-loops.test.types';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function loopFile(name: string, updatedAt: string, steps: Step[], extra = {}): string {
	const state = {
		name,
		goal: `Goal for ${name}`,
		createdAt: updatedAt,
		updatedAt,
		steps,
		...extra
	};
	return `${JSON.stringify(state, null, '\t')}\n`;
}

export function seed(root: string, dir: string, body: string): void {
	const loopDir = join(root, 'specification', 'loops', dir);
	mkdirSync(loopDir, { recursive: true });
	writeFileSync(join(loopDir, 'loop.json'), body);
}
