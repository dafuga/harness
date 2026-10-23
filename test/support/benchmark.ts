import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand } from './cli';
import { BenchmarkDefinitionValidator } from '../../src/cli/program/benchmark-service/benchmark-definition/BenchmarkDefinitionValidator';
import type {
	BenchmarkDefinition,
	BenchmarkRunner
} from '../../src/core/agents-providers/subagentBenchmarkTypes';

export const benchmarkFixtureDefinition = () =>
	new BenchmarkDefinitionValidator().validate({
		version: 1,
		name: 'component-value',
		task: 'Return one',
		contract: 'Export value equal to 1',
		allowedFiles: ['component.ts'],
		checks: [{ id: 'contract', command: 'bun check.ts' }],
		candidates: [{ id: 'agent', runner: 'codex', model: 'explicit-model', effort: 'medium' }],
		budget: { repetitions: 1, timeoutMs: 10000, repairs: 2 }
	});

export async function benchmarkFixture(): Promise<{
	root: string;
	path: string;
	definition: BenchmarkDefinition;
}> {
	const root = await mkdtemp(join(tmpdir(), 'harness-benchmark-'));
	await runCommand(['git', 'init', '-q'], root);
	await writeFile(join(root, 'component.ts'), 'export const value = 0;\n');
	await writeFile(
		join(root, 'check.ts'),
		"import { value } from './component'; if (value !== 1) { console.error('expected one'); process.exit(1); }\n"
	);
	await runCommand(['git', 'add', '.'], root);
	await runCommand(
		[
			'git',
			'-c',
			'user.name=Test',
			'-c',
			'user.email=test@example.com',
			'commit',
			'-qm',
			'fixture'
		],
		root
	);
	const path = join(root, 'benchmark.json');
	const definition = benchmarkFixtureDefinition();
	await writeFile(path, JSON.stringify(definition));
	return { root, path, definition };
}
export function fakeBenchmarkRunner(run: BenchmarkRunner['run']): BenchmarkRunner {
	return { preflight: async () => 'test-runner 1', run };
}
