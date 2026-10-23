import { sdkPackage } from '../utils/development-tooling/buildStamp';
import { registerCodexCommand } from './program/CodexCommand';
import { registerBenchmarkCommand } from './program/BenchmarkCommand';
import { registerAnalyticsCommand } from './program/AnalyticsCommand';
import { registerActivityCommand } from './program/ActivityCommand';
import { registerReportCommand } from './program/ReportCommand';
import { Command } from 'commander';
import { registerResponseCheckCommand } from './program/ResponseCheckCommand';
import { registerAuditCommand } from './program/audit';
import { registerGenerateCommand } from './program/generate';
import { registerInfoCommand } from './program/info';
import { registerLoopCommand } from './program/loop';
import { registerNewCommand } from './program/new';
import { registerUnitsCommand } from './program/UnitsCommand';
import { registerImpactCommand } from './program/ImpactCommand';
import { registerKernelCommand } from './program/KernelCommand';
import { registerScenariosCommand } from './program/ScenariosCommand';
import { registerExplainCommand } from './program/ExplainCommand';
import { registerBudgetCommand } from './program/BudgetCommand';
import { registerConsoleCommand } from './program/ConsoleCommand';
import { registerHistoryCommand } from './program/HistoryCommand';
import { registerHooksCommand } from './program/HooksCommand';
import { registerVerifyCommand } from './program/VerifyCommand';

export function buildProgram(): Command {
	const program = new Command();

	program
		.name('harness')
		.description('Opinionated Rails-inspired coding harnesses for humans and agents.')
		.version(sdkPackage.version);

	registerCodexCommand(program);
	registerBenchmarkCommand(program);
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
	registerHistoryCommand(program);
	registerHooksCommand(program);
	registerConsoleCommand(program);
	registerAuditCommand(program);
	registerResponseCheckCommand(program);

	return program;
}
