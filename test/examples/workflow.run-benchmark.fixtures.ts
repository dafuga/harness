import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TemporaryRepo } from '../support/temporary.types';

export function writeBenchmarkDefinition(repo: TemporaryRepo): string {
	const definition = {
		version: 1,
		name: 'component-value',
		project: '.',
		revision: 'HEAD',
		task: 'Set the component value to one.',
		contract: 'component.ts exports value equal to one.',
		allowedFiles: ['component.ts'],
		checks: [{ id: 'value', command: './check-value.sh' }],
		setup: [],
		candidates: [
			{
				id: 'codex-pass',
				runner: 'codex',
				model: 'fixture-codex',
				effort: 'high',
				instructions: '',
				tools: 'default'
			},
			{
				id: 'claude-error',
				runner: 'claude',
				model: 'fixture-claude',
				effort: 'medium',
				instructions: '',
				tools: 'default'
			}
		],
		budget: { repetitions: 1, timeoutMs: 10000, repairs: 0 }
	};
	const path = join(repo.root, 'benchmark.json');
	writeFileSync(path, JSON.stringify(definition));
	return path;
}
