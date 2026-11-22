import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BenchmarkRunners } from '../../src/cli/program/benchmark-service/benchmarkDefinition.types';
import type { BenchmarkRunner } from '../../src/core/agents-providers/subagentBenchmarkTypes';

export function fixtureRunners(): BenchmarkRunners {
	const codex: BenchmarkRunner = {
		preflight: async () => 'codex fixture 1',
		run: async ({ candidate, cwd }) => {
			writeFileSync(join(cwd, 'component.ts'), 'export const value = 1;\n');
			return {
				session: `${candidate.id}-session`,
				reportedModel: candidate.model,
				usage: { inputTokens: 12, outputTokens: 3 }
			};
		}
	};
	const claude: BenchmarkRunner = {
		preflight: async () => 'claude fixture 1',
		run: async ({ candidate }) => {
			throw new Error(`${candidate.id} fixture failure`);
		}
	};
	return { codex, claude };
}
