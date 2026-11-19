// @harness-uid u_5hbkzkvulq
import type { Flags } from './VerifyCommand.types';
import type { Command } from 'commander';
import { Option } from 'commander';
import { fail } from '../../core/development-tooling/errors';
import { verificationModes } from '../../core/verification-evidence/verifyTypes';
import { capturePage } from '../../workflows/verification-evidence/run-verify/capturePage';
import {
	renderVerify,
	verifyCheck,
	verifyIdentity,
	verifyPlan,
	verifyRun,
	verifyStamp
} from '../../workflows/verification-evidence/run-verify/runVerify';

export function registerVerifyCommand(program: Command): void {
	const verify = program
		.command('verify')
		.description('Verify an exact commit in a clean snapshot and gate on its record.');
	verify
		.command('run')
		.addOption(profileOption())
		.option('--priority <kind>', 'agent-test, coding or environment; default environment.')
		.option(
			'--commit <revision>',
			'Commit to verify; uncommitted changes are never included.',
			'HEAD'
		)
		.option(
			'--base <revision>',
			'Revision to compare against, used only if a passing record proves it; default first parent.'
		)
		.option(
			'--runtime <kind>',
			'Kernel runtime for impact: default, module, wasm, process or http.'
		)
		.option('--test-timeout <ms>', 'Hard limit for each check, overriding the configured one.')
		.option(
			'--require-performance',
			'Require current latency and memory profiling independently of budgets.'
		)
		.option(
			'--entity <id>',
			'Verify this entity and automatically attach complete screenshots; never a full-commit pass.'
		)
		.option('--json', 'Print the record and its directory.')
		.description('Run the affected checks and scenarios and store the record, pass or fail.')
		.action(runVerification);
	registerPlan(verify);
	verify
		.command('check')
		.option('--commit <revision>', 'Commit the record must prove.', 'HEAD')
		.option('--record <file>', 'Record file to check instead of the latest stored one.')
		.option('--json', 'Print structured results.')
		.description('Fail unless a stored record proves this exact commit and its evidence is intact.')
		.action(async (flags: Flags) => {
			const report = await verifyCheck(flags);
			if (flags.json) console.log(JSON.stringify(report, null, 2));
			if (report.status === 'failed' && !flags.json) fail(report.problems.join('\n'));
			if (report.status === 'failed') process.exitCode = 1;
			else if (!flags.json)
				console.log(`Commit ${report.commit} is verified by ${report.record.slice(0, 12)}.`);
		});
	registerIdentity(verify);
	registerCapture(verify);
}

function registerCapture(verify: Command): void {
	verify
		.command('capture <url>')
		.requiredOption('--output <file>', 'Destination for one PNG.')
		.option('--browser <path>', 'Chrome Headless Shell executable.', 'chrome-headless-shell')
		.option('--viewport <size>', 'Width and height in pixels.', '1280x720')
		.description('Capture one page in an isolated browser profile.')
		.action(async (url: string, options: Parameters<typeof capturePage>[1]) => {
			console.log(await capturePage(url, options));
		});
}

function registerPlan(verify: Command): void {
	verify
		.command('plan')
		.addOption(profileOption())
		.option(
			'--commit <revision>',
			'Commit to plan; uncommitted changes are never included.',
			'HEAD'
		)
		.option(
			'--base <revision>',
			'Revision to compare against, used only if a passing record proves it; default first parent.'
		)
		.option(
			'--runtime <kind>',
			'Local kernel runtime for impact: default, module, wasm or process; http is disallowed.'
		)
		.option('--test-timeout <ms>', 'Hard limit for each check, overriding the configured one.')
		.option('--entity <id>', 'Report only this entity’s scenario checks.')
		.option('--json', 'Print the report as JSON.')
		.description('Report selected checks and grouping candidates without running checks.')
		.action(async (flags: Flags) => {
			const report = await verifyPlan(flags);
			console.log(flags.json ? JSON.stringify(report, null, 2) : renderPlan(report));
		});
}

function profileOption(): Option {
	return new Option('--profile <profile>', 'Full verification or browser-free Lite checks.')
		.choices([...verificationModes])
		.default('full');
}

function renderPlan(report: Awaited<ReturnType<typeof verifyPlan>>): string {
	return [
		`Verification plan for ${report.source.commit} (${report.mode}; checks executed: 0).`,
		`Base: ${report.source.baseResolution}. ${report.source.selectionNote}`,
		report.sideEffects,
		`Selected ${report.plannedChecks} checks; ${report.candidateGroups} candidate groups cover ${report.candidateChecks} checks.`,
		...(report.pendingChecks ?? []).map((check) => `  pending full verification: ${check}`),
		`${report.singletons} singletons; ${report.ineligible} checks could not be grouped safely.`,
		...report.candidates.map(
			(candidate) =>
				`  ${candidate.id}: ${candidate.checks.length} ${candidate.runner} checks, cwd ${candidate.cwd}, timeout ${candidate.timeoutMs} ms`
		),
		...report.checks
			.filter((check) => check.decision !== 'candidate')
			.map((check) => `  ${check.decision}: ${check.id} (${check.reason})`)
	].join('\n');
}

async function runVerification(flags: Flags): Promise<void> {
	const stored = await verifyRun(flags);
	console.log(flags.json ? JSON.stringify(stored, null, 2) : renderVerify(stored));
	const status = stored.attachment?.status ?? stored.record.lite?.status ?? stored.record.status;
	if (['failed', 'skipped'].includes(status)) process.exitCode = 1;
}

function registerIdentity(verify: Command): void {
	verify
		.command('identity <directory>')
		.option('--json', 'Print structured results.')
		.description('Print the identity of a compiled build directory, as a server should report it.')
		.action(async (directory: string, flags: Flags) => {
			const build = await verifyIdentity(directory);
			console.log(flags.json ? JSON.stringify(build, null, 2) : build.buildId);
		});
	verify
		.command('stamp <directory>')
		.option('--json', 'Print structured results.')
		.description(
			'Write the identity of a compiled directory into its stamp slots, for a server that cannot read its own files.'
		)
		.action(async (directory: string, flags: Flags) => {
			const build = await verifyStamp(directory);
			console.log(flags.json ? JSON.stringify(build, null, 2) : build.buildId);
		});
}
