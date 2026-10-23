import type { BenchmarkEvaluationInput } from './benchmarkEvaluate.types';
export type { BenchmarkEvaluationInput } from './benchmarkEvaluate.types';
import { join } from 'node:path';
import { lstat } from 'node:fs/promises';
import type {
	BenchmarkDefinition,
	BenchmarkSubmission
} from '../../../core/agents-providers/subagentBenchmarkTypes';
import { benchmarkProcess } from './benchmarkProcess';
import {
	benchmarkFileValue,
	benchmarkGit,
	createBenchmarkWorkspace,
	overlayBenchmarkFiles
} from './benchmarkWorkspace';
export async function evaluateBenchmarkSubmission(
	input: BenchmarkEvaluationInput
): Promise<BenchmarkSubmission> {
	input.signal.throwIfAborted();
	const invalidFiles = await invalidBenchmarkFiles(input);
	if (invalidFiles.length) return { passed: false, invalidFiles, checks: [], patch: '' };
	await createBenchmarkWorkspace(input.baseline, input.evaluation);
	await overlayBenchmarkFiles(input.workspace, input.evaluation, input.definition.allowedFiles);
	await benchmarkGit(input.evaluation, ['add', '-A', '-f']);
	const patch = await benchmarkGit(input.evaluation, ['diff', '--cached', '--binary', 'HEAD']);
	await setupBenchmarkWorkspace(input.evaluation, input.definition, input.signal);
	const checks = [];
	for (const check of input.definition.checks) {
		const started = Date.now();
		const result = await benchmarkProcess({
			command: ['sh', '-c', check.command],
			cwd: input.evaluation,
			signal: input.signal
		});
		checks.push({ id: check.id, durationMs: Date.now() - started, ...result });
	}
	return { passed: checks.every((check) => check.exitCode === 0), invalidFiles, checks, patch };
}
export async function setupBenchmarkWorkspace(
	cwd: string,
	definition: BenchmarkDefinition,
	signal: AbortSignal
): Promise<void> {
	for (const command of definition.setup) {
		const result = await benchmarkProcess({ command: ['sh', '-c', command], cwd, signal });
		if (result.exitCode) throw new Error('Benchmark workspace setup failed.');
	}
}
async function invalidBenchmarkFiles(input: BenchmarkEvaluationInput): Promise<string[]> {
	const listed = await benchmarkGit(input.workspace, [
		'ls-files',
		'-z',
		'--cached',
		'--others',
		'--exclude-standard'
	]);
	const files = new Set([
		...input.files,
		...listed.split('\0').filter(Boolean),
		...input.definition.allowedFiles
	]);
	const invalid: string[] = [];
	for (const file of files) {
		const before = await benchmarkFileValue(input.baseline, file);
		const after = await benchmarkFileValue(input.workspace, file);
		const exists = await lstat(join(input.workspace, file)).catch(() => undefined);
		if (
			(exists && after === undefined) ||
			(before !== after && !input.definition.allowedFiles.includes(file))
		)
			invalid.push(file);
	}
	return invalid;
}
