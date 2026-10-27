import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { scenarioManifestSchema, type ScenarioManifest } from '../src/core/unitTypes';
import { recordCapture } from '../src/utils/record-capture/recordCapture';
import { verificationTarget, type VerificationTarget } from './verification-targets';
import { verifiedAssertions } from './verification-assertions';

function captureOutput(target: VerificationTarget, scenario: ScenarioManifest, output: string) {
	for (const evidence of scenario.evidence.filter((item) => item.kind === 'output')) {
		for (const state of evidence.states.filter((state) => target.states.includes(state))) {
			recordCapture(
				{
					evidence: evidence.id,
					kind: 'output',
					state,
					file: `${target.target.replaceAll('/', '-')}-${state}.txt`,
					mediaType: 'text/plain',
					note: `Supplemental actual ${target.runner} output for ${target.target}.`
				},
				output,
				{ ...process.env, TAKE_SCREENSHOT: '1' }
			);
		}
	}
}
function captureAssertions(
	target: VerificationTarget,
	scenario: ScenarioManifest,
	data: ReturnType<typeof verifiedAssertions>
) {
	for (const evidence of scenario.evidence.filter((item) => item.kind === 'assertions')) {
		for (const state of evidence.states.filter((state) => target.states.includes(state))) {
			const tests = data.filter((test) => test.state === state);
			if (!tests.length) throw new Error(`Missing observations for ${state}`);
			recordCapture(
				{
					evidence: evidence.id,
					kind: 'assertions',
					state,
					file: `${target.target.replaceAll('/', '-')}-${state}.json`,
					mediaType: 'application/json'
				},
				JSON.stringify({
					schemaVersion: 1,
					runner: target.runner,
					target: target.target,
					state,
					tests
				}),
				{ ...process.env, TAKE_SCREENSHOT: '1' }
			);
		}
	}
}
function request() {
	const args = process.argv.slice(2);
	const [runner, file] = args;
	if (args.length !== 2 || !['vitest', 'playwright'].includes(runner ?? '') || !file)
		throw new Error('Expected exactly one runner and test file');
	const requested = Boolean(process.env.HARNESS_SCENARIO ?? process.env.HARNESS_EVIDENCE_DIR);
	const target = requested
		? verificationTarget(process.env.HARNESS_SCENARIO ?? '', runner, file, process.cwd())
		: null;
	if (requested && !process.env.HARNESS_EVIDENCE_DIR) throw new Error('Missing evidence directory');
	return { runner, file, target };
}
function run() {
	const { runner, file, target } = request();
	const directory = mkdtempSync(join(tmpdir(), 'harness-runner-'));
	try {
		const invocation = randomUUID(),
			report = join(directory, 'report.json');
		const args =
			runner === 'vitest'
				? [
						'x',
						runner,
						'run',
						file,
						'--testTimeout',
						'20000',
						'--hookTimeout',
						'20000',
						'--reporter=default',
						'--reporter=json',
						`--reporter=${resolve(import.meta.dirname, '../src/adapters/verification-evidence/CaseResultAdapter.ts')}`,
						`--outputFile.json=${report}`
					]
				: ['x', runner, 'test', file];
		const result = spawnSync('bun', args, {
			encoding: 'utf8',
			env: { ...process.env, HARNESS_ASSERTION_RUN_ID: invocation },
			maxBuffer: 8_000_000
		});
		const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
		process.stdout.write(output);
		if (target) collect(target, { output, report, invocation, status: result.status });
		if (result.error) throw result.error;
		return result.status ?? 1;
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
function collect(
	target: VerificationTarget,
	result: { output: string; report: string; invocation: string; status: number | null }
) {
	const path = resolve(
		import.meta.dirname,
		'../specification/scenarios',
		`${target.scenario}.json`
	);
	const scenario = scenarioManifestSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
	captureOutput(target, scenario, result.output);
	if (target.runner !== 'vitest') return;
	const data = verifiedAssertions(target, {
		report: JSON.parse(readFileSync(result.report, 'utf8')),
		observations: readFileSync(
			join(process.env.HARNESS_EVIDENCE_DIR!, 'assertions.ndjson'),
			'utf8'
		),
		invocation: result.invocation,
		cwd: process.cwd(),
		status: result.status
	});
	captureAssertions(target, scenario, data);
}
process.exitCode = run();
