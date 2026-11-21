// @harness-uid u_r7ovtiyjki
import { CommanderError } from 'commander';
import { loadCliProgram } from './loadCliProgram';
import { staleBuild } from '../utils/development-tooling/staleBuild';
import { pipedOutput } from '../utils/development-tooling/pipedOutput';
import { isExpectedCliError } from '../core/development-tooling/errors';
import { skipsAnalytics } from '../workflows/reports-media/skipsAnalytics';

/** Shared executable entry; compatibility imports never call it. */
export async function runCli(entry: string): Promise<void> {
	const args = process.argv.slice(2);
	// Tracker owns compatibility flags and its role selector.
	if (args[0] === 'tracker') {
		const { TrackerCommand } = await import('../commands/projects-sessions/TrackerCommand');
		process.exitCode = await new TrackerCommand().run(args.slice(1));
		return;
	}
	pipedOutput();
	const warning = staleBuild(entry);
	if (warning) console.error(warning);
	const startedAt = Date.now();
	try {
		await (await loadCliProgram(args)).exitOverride().parseAsync(process.argv);
	} catch (error) {
		if (error instanceof CommanderError) process.exitCode = error.exitCode;
		else {
			process.exitCode = 1;
			if (isExpectedCliError(error)) console.error(`Error: ${error.message}`);
			else throw error;
		}
	} finally {
		await finishCommand(startedAt);
	}
}
async function finishCommand(startedAt: number): Promise<void> {
	if (!skipsAnalytics(process.argv.slice(2))) {
		const { recordCommandAnalytics } =
			await import('../workflows/reports-media/recordCommandAnalytics');
		await recordCommandAnalytics(process.argv.slice(2), startedAt, process.exitCode);
	}
	if (process.env.HARNESS_AGENT_ID?.trim()) {
		const { beatFromEnvironment } = await import('../workflows/projects-sessions/runActivity');
		await beatFromEnvironment();
	}
	if (
		process.argv[2] === 'loop' &&
		!skipsAnalytics(process.argv.slice(2)) &&
		process.env.HARNESS_ANALYTICS_DISABLED !== '1'
	) {
		try {
			const { importAnalytics } = await import('../workflows/reports-media/importAnalytics');
			await importAnalytics(process.cwd(), false);
		} catch {
			console.error('Warning: loop analytics could not be synchronized.');
		}
	}
}
