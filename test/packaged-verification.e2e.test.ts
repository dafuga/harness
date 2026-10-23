import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { captureLineSchema } from '../src/core/verification-evidence/verifyTypes';
import {
	evidenceRequested,
	recordCapture
} from '../src/utils/reports-media/record-capture/recordCapture';
import { runCommand } from './support/cli';
import { completeProposal } from './support/taskAuditRepo';

/** Keep actual SDK-consumer profiles in the requesting Harness run before the consumer is removed. */
async function forwardProfiles(directory: string): Promise<void> {
	if (!evidenceRequested()) return;
	const index = await readFile(join(directory, 'captures.ndjson'), 'utf8');
	for (const line of index.trim().split('\n')) {
		const capture = captureLineSchema.parse(JSON.parse(line));
		if (capture.kind === 'benchmark')
			recordCapture(capture, await readFile(join(directory, capture.file)));
	}
}

const consumer = `
import {
	budgetEventSchema,
	budgetFindings,
	captureLineSchema,
	comparisonContext,
	evidenceRequested,
	explanationSchema,
	mediaFacts,
	TaskCompletionService,
	PerformanceProfileService,
	recordCapture,
	scenarioRequirements,
	verifyConfigSchema,
	type BudgetEvent,
	type CaptureLine,
	type Explanation,
	type VerifyConfig
} from '@dafuga01/harness/verification';
import { scenarioManifestSchema, type ScenarioManifest } from '@dafuga01/harness/contracts';

const scenario: ScenarioManifest = scenarioManifestSchema.parse(JSON.parse(process.argv[2]));
const audit = new TaskCompletionService(process.cwd());
const proposal = ${JSON.stringify(completeProposal)};
for (const unit of ['service.task-completion', 'module.verification'])
	await new PerformanceProfileService().capture(
		{ unit, workload: 'public-planning-audit', rounds: 3, iterations: 10 },
		() => audit.requirePlan(proposal, 'Search proposal')
	);
const line: CaptureLine = { evidence: 'output', kind: 'output', state: 'default', file: 'out.txt', mediaType: 'text/plain' };
const explanation: Explanation | undefined = explanationSchema.safeParse({}).data;
const event: BudgetEvent | undefined = budgetEventSchema.safeParse({}).data;
const config: VerifyConfig | undefined = verifyConfigSchema.safeParse({}).data;
const findings = budgetFindings({
	unit: 'function.rank',
	profile: 'p',
	defaultTarget: 'module',
	budgets: [],
	measurements: [],
	baseline: undefined,
	checkSize: true
});
const sampling = { rounds: 5, iterations: 30 };
const context = comparisonContext({ operation: 'rank', input: { size: 20000 } }, sampling);
const cheaper = comparisonContext({ operation: 'rank', input: { size: 1 } }, sampling);
const label = { workload: 'rank-20k', metric: 'latency-floor-ms', target: 'module' as const, profile: 'p' };
const definition = { unitOfMeasure: 'ms', method: 'Fastest end-to-end call.', comparison: context };
const frozen = { ...label, ...definition, value: 10 };
const measured = { ...label, ...definition, unit: 'function.rank', value: 10.2 };
const compare = (measurement: typeof measured | Omit<typeof measured, 'comparison'>, baseline = frozen) =>
	budgetFindings({
		unit: 'function.rank',
		profile: 'p',
		defaultTarget: 'module',
		budgets: [{ workload: 'rank-20k', metric: 'latency-floor-ms', tolerance: 0.05 }],
		measurements: [measurement],
		baseline: { metrics: {}, performance: [baseline] },
		checkSize: false
	})[0].status;
const { comparison: _dropped, ...labelOnly } = measured;
console.log(JSON.stringify({
	planningAudit: 'accepted',
	comparable: [
		compare(measured),
		compare({ ...measured, unitOfMeasure: 'seconds', value: 0.01 }),
		compare({ ...measured, value: 0.001, comparison: cheaper }),
		compare(labelOnly)
	],
	required: scenarioRequirements(scenario).required.length,
	requested: evidenceRequested(),
	recorded: recordCapture(captureLineSchema.parse(line), 'hello'),
	media: mediaFacts(Buffer.from('nope'), 'image/png'),
	findings: findings.map((finding) => finding.status),
	parsed: [explanation === undefined, event === undefined, config === undefined]
}));
`;

const expected = {
	planningAudit: 'accepted',
	comparable: ['passed', 'incompatible', 'incompatible', 'incomplete'],
	required: 1,
	requested: true,
	recorded: true,
	media: { error: 'missing PNG signature' },
	findings: ['missing-measurement', 'missing-measurement', 'missing-measurement'],
	parsed: [true, true, true]
};

test('a packed consumer uses the verification contracts and evidence protocol', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-verification-api-'));
	const tarball = join(root, 'harness.tgz');
	await runCommand(['bun', 'pm', 'pack', '--ignore-scripts', '--filename', tarball], process.cwd());
	const project = join(root, 'consumer');
	await mkdir(project);
	const manifest = {
		name: 'consumer',
		private: true,
		type: 'module',
		dependencies: { '@dafuga01/harness': `file:${tarball}` },
		devDependencies: { typescript: '^5.8.3', '@types/node': '^22.15.3' }
	};
	const compilerOptions = {
		target: 'ES2022',
		module: 'ESNext',
		moduleResolution: 'Bundler',
		strict: true,
		noEmit: true,
		types: ['node']
	};
	await writeFile(join(project, 'package.json'), JSON.stringify(manifest));
	await writeFile(
		join(project, 'tsconfig.json'),
		JSON.stringify({ compilerOptions, include: ['consumer.ts'] })
	);
	await writeFile(join(project, 'consumer.ts'), consumer);
	await runCommand(['bun', 'install'], project);
	for (const optional of ['svelte', '@sveltejs/kit'])
		expect(existsSync(join(project, 'node_modules', optional))).toBe(false);
	const typecheck = await runCommand(['bun', 'x', 'tsc', '-p', '.'], project, false);
	expect(typecheck.stdout + typecheck.stderr).toBe('');

	const scenario = await readFile('specification/scenarios/package-api.json', 'utf8');
	const evidence = join(root, 'evidence');
	const env = { HARNESS_EVIDENCE_DIR: evidence, TAKE_SCREENSHOT: '1' };
	for (const runner of ['bun', 'node']) {
		const run = await runCommand([runner, 'consumer.ts', scenario], project, true, env);
		expect(JSON.parse(run.stdout), runner).toEqual(expected);
	}
	expect(await readFile(join(evidence, 'out.txt'), 'utf8')).toBe('hello');
	expect(await readFile(join(evidence, 'captures.ndjson'), 'utf8')).toContain('"file":"out.txt"');
	await forwardProfiles(evidence);
	await rm(root, { recursive: true, force: true });
}, 240_000);
