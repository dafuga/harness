import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { BoundedCommandAdapter } from '../../../adapters/execution-runtimes/BoundedCommandAdapter';
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { CompletionCheckError } from './CompletionCheckError';
import { lcovCoverage } from './lcovCoverage';
import type { ModuleCompletionMeasurement } from './moduleCompletionMeasurement.types';
import type { ModuleMeasurement } from './completionRun.types';

export async function moduleCompletionMeasurement(
	input: ModuleCompletionMeasurement,
	commit: string,
	reportDir: string,
	record: (reading: ModuleMeasurement) => void
) {
	const { git, source, tests, command, signal } = input;
	const reading: ModuleMeasurement = { bytes: await moduleFileBytes(git, commit, source, tests) };
	record(reading);
	if (!tests.length || (tests.some((path) => !/\.(test|spec)\.[jt]sx?$/.test(path)) && !command))
		throw new CompletionCheckError(
			'Declare runnable verificationFiles or configure moduleVerification.'
		);
	const report = join(reportDir, 'lcov.info');
	const [program, ...args] = command
		? command.flatMap((arg) => (arg === '{tests}' ? tests.map((path) => './' + path) : [arg]))
		: [
				'bun',
				'test',
				'--coverage',
				'--coverage-reporter=lcov',
				'--coverage-dir',
				reportDir,
				...tests.map((path) => './' + path)
			];
	const result = await new BoundedCommandAdapter().run(program, args, {
		cwd: git.root,
		signal,
		timeoutMs: 180_000,
		env: { HARNESS_COMPLETION_LCOV: report }
	});
	reading.testExitCode = result.code;
	if (result.code !== 0) throw new CompletionCheckError('Module verification tests failed.');
	reading.coverage = lcovCoverage(await readLcov(report), git.root, source);
	return reading;
}

async function moduleFileBytes(git: GitAdapter, commit: string, source: string[], tests: string[]) {
	const files = [...source, ...tests];
	const entries = await git.run([
		'--literal-pathspecs',
		'ls-tree',
		'-r',
		'-z',
		'-l',
		commit,
		'--',
		...files
	]);
	const sizes = new Map<string, number>();
	for (const row of entries.split('\0').filter(Boolean)) {
		const split = row.indexOf('\t');
		const path = row.slice(split + 1);
		const blob = row.slice(0, split).match(/^100(?:644|755) blob [a-f0-9]+ +([0-9]+)$/);
		if (!blob || !files.includes(path))
			throw new CompletionCheckError(
				'The module and verification scope must contain regular files.'
			);
		sizes.set(path, Number(blob[1]));
	}
	if (tests.some((path) => !sizes.has(path)))
		throw new CompletionCheckError('An admitted verification file is missing.');
	const bytes = (paths: string[]) =>
		paths.reduce((total, path) => total + (sizes.get(path) ?? 0), 0);
	return { source: bytes(source), tests: bytes(tests) };
}

async function readLcov(path: string): Promise<string> {
	try {
		const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		try {
			const stat = await file.stat();
			if (!stat.isFile() || stat.size > 8_000_000) throw new Error();
			const bytes = Buffer.alloc(stat.size);
			const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
			return bytes.subarray(0, bytesRead).toString('utf8');
		} finally {
			await file.close();
		}
	} catch {
		throw new CompletionCheckError('Module verification did not produce a readable LCOV report.');
	}
}
