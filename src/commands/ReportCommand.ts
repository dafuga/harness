import type { Command } from 'commander';
import { runReport } from '../workflows/runReport';
export function registerReportCommand(program: Command): void {
	program
		.command('report')
		.description('Create, serve, export and publish media reports.')
		.allowUnknownOption()
		.allowExcessArguments()
		.argument('[args...]')
		.action((args: string[]) => runReport(args));
}
