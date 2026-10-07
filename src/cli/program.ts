import { registerCodexCommand } from '../commands/CodexCommand';
import { registerAnalyticsCommand } from '../commands/AnalyticsCommand';
import { registerReportCommand } from '../commands/ReportCommand';
import { Command } from 'commander';
import { registerResponseCheckCommand } from '../commands/ResponseCheckCommand';
import { registerAuditCommand } from '../commands/audit';
import { registerGenerateCommand } from '../commands/generate';
import { registerInfoCommand } from '../commands/info';
import { registerLoopCommand } from '../commands/loop';
import { registerNewCommand } from '../commands/new';

export function buildProgram(): Command {
	const program = new Command();

	program
		.name('harness')
		.description('Opinionated Rails-inspired coding harnesses for humans and agents.')
		.version('0.1.1');

	registerCodexCommand(program);
	registerAnalyticsCommand(program);
	registerReportCommand(program);
	registerNewCommand(program);
	registerGenerateCommand(program);
	registerInfoCommand(program);
	registerLoopCommand(program);
	registerAuditCommand(program);
	registerResponseCheckCommand(program);

	return program;
}
