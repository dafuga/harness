// @harness-uid u_fcrdtoyvut
import type { Command } from 'commander';
import { runReport } from './run-report/runReport';
export function registerReportCommand(program: Command): void {
	program
		.command('report')
		.description('Record media reports and serve the website.')
		.allowUnknownOption()
		.allowExcessArguments()
		.argument('[args...]')
		.action((args: string[]) => runReport(args));
}
