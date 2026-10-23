import type { BenchmarkRunners, PreparedBenchmark } from './benchmarkDefinition.types';
export type { BenchmarkRunners, PreparedBenchmark } from './benchmarkDefinition.types';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { BenchmarkDefinitionValidator } from './benchmark-definition/BenchmarkDefinitionValidator';
import { benchmarkFiles, benchmarkGit } from './benchmarkWorkspace';
import { CodexBenchmarkAdapter } from './benchmark-definition/CodexBenchmarkAdapter';
import { ClaudeBenchmarkAdapter } from './benchmark-definition/ClaudeBenchmarkAdapter';
import { fingerprint } from '../../../workflows/reports-media/analyticsRecord';
export const benchmarkRunners = (): BenchmarkRunners => ({
	codex: new CodexBenchmarkAdapter(),
	claude: new ClaudeBenchmarkAdapter()
});
export async function prepareBenchmark(
	path: string,
	runners: BenchmarkRunners
): Promise<PreparedBenchmark> {
	const definition = new BenchmarkDefinitionValidator().validate(
		JSON.parse(await readFile(path, 'utf8'))
	);
	const project = await realpath(resolve(dirname(resolve(path)), definition.project));
	const gitRoot = (await benchmarkGit(project, ['rev-parse', '--show-toplevel'])).trim();
	if (project !== (await realpath(gitRoot)))
		throw new Error('Benchmark project must be the Git repository root.');
	const revision = (
		await benchmarkGit(project, [
			'rev-parse',
			'--verify',
			'--end-of-options',
			`${definition.revision}^{commit}`
		])
	).trim();
	await benchmarkFiles(project, revision);
	const runnerVersions: Record<string, string> = {};
	for (const candidate of definition.candidates)
		runnerVersions[candidate.id] = await runners[candidate.runner].preflight(candidate);
	const { name, task, contract, allowedFiles, checks, setup, budget } = definition;
	const comparison = { name, task, contract, allowedFiles, checks, setup, budget };
	return {
		definition,
		project,
		revision,
		runnerVersions,
		fingerprint: fingerprint({ revision, task: comparison }),
		trials: definition.budget.repetitions * definition.candidates.length
	};
}
