import type { Flags } from './VerifyCommand.types';
import type { Command } from 'commander';
import { fail } from '../../core/development-tooling/errors';
import {
	renderVerify,
	verifyCheck,
	verifyIdentity,
	verifyRun,
	verifyStamp
} from '../../workflows/verification-evidence/run-verify/runVerify';

export function registerVerifyCommand(program: Command): void {
	const verify = program
		.command('verify')
		.description('Verify an exact commit in a clean snapshot and gate on its record.');
	verify
		.command('run')
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
		.option('--json', 'Print the record and its directory.')
		.description('Run the affected checks and scenarios and store the record, pass or fail.')
		.action(async (flags: Flags) => {
			const stored = await verifyRun(flags);
			console.log(flags.json ? JSON.stringify(stored, null, 2) : renderVerify(stored));
			if (stored.record.status !== 'passed') process.exitCode = 1;
		});
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
