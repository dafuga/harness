import { sdkPackage } from '../utils/buildStamp';
import { registerCodexCommand } from '../commands/CodexCommand';
import { registerAnalyticsCommand } from '../commands/AnalyticsCommand';
import { registerActivityCommand } from '../commands/ActivityCommand';
import { registerReportCommand } from '../commands/ReportCommand';
import { Command } from 'commander';
import { registerResponseCheckCommand } from '../commands/ResponseCheckCommand';
import { registerAuditCommand } from '../commands/audit';
import { registerGenerateCommand } from '../commands/generate';
import { registerInfoCommand } from '../commands/info';
import { registerLoopCommand } from '../commands/loop';
import { registerNewCommand } from '../commands/new';
import { registerUnitsCommand } from '../commands/UnitsCommand';
import { registerImpactCommand } from '../commands/ImpactCommand';
import { registerKernelCommand } from '../commands/KernelCommand';
import { registerScenariosCommand } from '../commands/ScenariosCommand';
import { registerExplainCommand } from '../commands/ExplainCommand';
import { registerBudgetCommand } from '../commands/BudgetCommand';
import { registerConsoleCommand } from '../commands/ConsoleCommand';
import { registerHistoryCommand } from '../commands/HistoryCommand';
import { registerHooksCommand } from '../commands/HooksCommand';
import { registerVerifyCommand } from '../commands/VerifyCommand';
import { registerTaskCommand } from '../commands/TaskCommand';

export function buildProgram(): Command {
	const program = new Command();

	program
		.name('harness')
		.description('Opinionated Rails-inspired coding harnesses for humans and agents.')
		.version(sdkPackage.version);

	registerCodexCommand(program);
	registerAnalyticsCommand(program);
	registerActivityCommand(program);
	registerReportCommand(program);
	registerNewCommand(program);
	registerGenerateCommand(program);
	registerInfoCommand(program);
	registerLoopCommand(program);
	registerUnitsCommand(program);
	registerImpactCommand(program);
	registerKernelCommand(program);
	registerScenariosCommand(program);
	registerExplainCommand(program);
	registerBudgetCommand(program);
	registerVerifyCommand(program);
	registerTaskCommand(program);
	registerHistoryCommand(program);
	registerHooksCommand(program);
	registerConsoleCommand(program);
	registerAuditCommand(program);
	registerResponseCheckCommand(program);

	return program;
}
