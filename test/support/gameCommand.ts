import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { captureLineSchema, benchmarkCaptureSchema } from '../../src/core/verifyTypes';
import { evidenceRequested, recordCapture } from '../../src/utils/record-capture/recordCapture';

interface Scope {
	units: string[];
	workload: string;
	cli?: string;
}
interface Observed {
	elapsedMs: number;
	peakRssBytes: number;
	stdout: string;
}
/** What the driver prints: Bun's raw `maxRSS` and the platform whose accounting produced it. */
interface Reported {
	elapsedMs: number;
	maxRSS: number;
	platform: string;
	stdout: string;
}
const driver = `
const {command,cwd}=JSON.parse(process.argv[1]);
const started=performance.now();
const result=Bun.spawnSync(command,{cwd,env:process.env,stdout:'pipe',stderr:'pipe'});
const elapsedMs=performance.now()-started;
if(result.exitCode!==0)throw new Error(result.stderr.toString());
console.log(JSON.stringify({elapsedMs,maxRSS:result.resourceUsage.maxRSS,platform:process.platform,stdout:result.stdout.toString()}));`;

/** Run the real normal command; observe its child process rather than the test worker. */
export function gameCommand(command: string[], cwd: string, scope: Scope): Observed {
	const reported: Reported = JSON.parse(
		execFileSync('bun', ['-e', driver, JSON.stringify({ command, cwd })], {
			encoding: 'utf8',
			env: { ...process.env, HARNESS_CLI_PATH: scope.cli ?? resolve('src/index.ts') }
		})
	);
	const output: Observed = {
		elapsedMs: reported.elapsedMs,
		peakRssBytes: bunMaxRssBytes(reported.maxRSS, reported.platform),
		stdout: reported.stdout
	};
	if (!(output.elapsedMs > 0) || !(output.peakRssBytes > 0))
		throw new Error('Game command requires actual positive timing and child RSS observations.');
	if (evidenceRequested()) recordCommand(scope, output);
	return output;
}
/**
 * Bun 1.2.18 passes the OS `ru_maxrss` through unchanged: bytes on macOS, KiB on Linux, and Windows
 * PeakWorkingSetSize / 1024. Recorded figures are bytes, so convert KiB and refuse unknown units.
 */
export function bunMaxRssBytes(maxRss: number, platform: string): number {
	if (platform === 'darwin') return maxRss;
	if (platform === 'linux' || platform === 'win32') return maxRss * 1024;
	throw new Error(`Bun maxRSS units are not established for ${platform}.`);
}
export function createGameWithCli(cli: string, root: string, dimension: string, entry: string) {
	return gameCommand(['bun', cli, 'new', 'game', 'adventure', '--dimension', dimension], root, {
		cli,
		workload: `game-new-${dimension}-${entry}`,
		units: [
			'command.new',
			'workflow.create-project',
			'template.project',
			'template.game-project',
			'template.project-tests'
		]
	});
}
export function generateGamePieces(cli: string, cwd: string, dimension: string, entry: string) {
	for (const [kind, name] of [
		['view', 'inventory'],
		['game-view', 'battle'],
		['mechanic', 'combat'],
		['checkpoint', 'victory']
	])
		gameCommand(['bun', cli, 'generate', kind, name], cwd, {
			cli,
			workload: `game-generate-${dimension}-${entry}-${kind}`,
			units: [
				'workflow.generate-code',
				'function.project',
				'template.pieces',
				...(kind === 'view' ? [] : ['template.game-pieces'])
			]
		});
}
function recordCommand(scope: Scope, output: Observed) {
	const measurements = scope.units.flatMap((unit) => {
		const common = { unit, workload: scope.workload, target: 'process', samples: 1 };
		return [
			{
				...common,
				metric: 'command-wall-ms',
				unitOfMeasure: 'ms',
				value: output.elapsedMs,
				method:
					'Wall time from launching the normal command through exit, including Bun startup, I/O and delegated work; not isolated unit timing.'
			},
			{
				...common,
				metric: 'command-max-rss-bytes',
				unitOfMeasure: 'bytes',
				value: output.peakRssBytes,
				method:
					'Bun-reported maximum RSS for the launched command subprocess using OS child accounting, converted to bytes from KiB on Linux and Windows; includes descendants only as aggregated by that OS. Excludes the test worker and renderer/GPU; not isolated unit memory.'
			}
		];
	});
	recordCapture(
		captureLineSchema.parse({
			evidence: 'game-command-workloads',
			kind: 'benchmark',
			state: scope.workload,
			file: 'game-command-' + randomUUID() + '.json',
			mediaType: 'application/json'
		}),
		JSON.stringify(benchmarkCaptureSchema.parse({ measurements }))
	);
}
