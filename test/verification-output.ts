import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scenarioManifestSchema } from '../src/core/unitTypes';
import { recordCapture } from '../src/utils/recordCapture';

/** Preserve actual runner output; the verifier still requires every scenario check to pass. */
const [runner, target] = process.argv.slice(2);
if (!['vitest', 'playwright'].includes(runner ?? '') || !target) {
	throw new Error('Expected vitest or playwright and a test file');
}
const args =
	runner === 'vitest'
		? ['x', runner, 'run', target, '--testTimeout', '20000', '--hookTimeout', '20000']
		: ['x', runner, 'test', target];
const result = spawnSync('bun', args, { encoding: 'utf8', env: process.env, maxBuffer: 8_000_000 });
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
process.stdout.write(output);
if (process.env.HARNESS_SCENARIO && process.env.HARNESS_EVIDENCE_DIR) {
	const path = resolve(
		import.meta.dirname,
		'../specification/scenarios',
		`${process.env.HARNESS_SCENARIO}.json`
	);
	const scenario = scenarioManifestSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
	for (const evidence of scenario.evidence.filter((item) => item.kind === 'output')) {
		for (const state of evidence.states) {
			recordCapture(
				{
					evidence: evidence.id,
					kind: 'output',
					state,
					file: `${state}.txt`,
					mediaType: 'text/plain',
					note: `Actual ${runner} output for ${target}; every scenario check is required separately.`
				},
				output,
				{ ...process.env, TAKE_SCREENSHOT: '1' }
			);
		}
	}
}
if (result.error) throw result.error;
process.exit(result.status ?? 1);
