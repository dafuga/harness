import { CommanderError } from 'commander';
import { commandAction } from '../utils/development-tooling/commandAction';
import { ValidateCommand } from '../commands/development-tooling/ValidateCommand';
import { PermissionsCommand } from '../commands/networking-security/PermissionsCommand';
import { registerTaskCommand } from './program/TaskCommand';
import { ModuleCommand } from '../commands/module-system/ModuleCommand';
import { ApiCommand } from '../commands/networking-security/ApiCommand';
import { sdkPackage } from '../utils/development-tooling/buildStamp';
import { registerCodexCommand } from './program/CodexCommand';
import { registerBenchmarkCommand } from './program/BenchmarkCommand';
import { registerAnalyticsCommand } from './program/AnalyticsCommand';
import { registerActivityCommand } from './program/ActivityCommand';
import { registerReportCommand } from './program/ReportCommand';
import { registerResourcesCommand } from './program/ResourcesCommand';
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
import { recordAnalytics } from '../workflows/reports-media/analyticsRecord';
import { importAnalytics } from '../workflows/reports-media/importAnalytics';
import { beatFromEnvironment } from '../workflows/projects-sessions/runActivity';
import { isExpectedCliError } from '../core/development-tooling/errors';
import { pipedOutput } from '../utils/development-tooling/pipedOutput';

export function buildProgram(): Command {
	const program = new Command();

	program
		.name('harness')
		.description('Opinionated Rails-inspired coding harnesses for humans and agents.')
		.version(sdkPackage.version);

	registerCodexCommand(program);
	registerBenchmarkCommand(program);
	registerResourcesCommand(program);
	registerAnalyticsCommand(program);
	registerActivityCommand(program);
	registerReportCommand(program);
	registerNewCommand(program);
	registerGenerateCommand(program);
	registerInfoCommand(program);
	registerLoopCommand(program);
	registerUnitsCommand(program);
	new ValidateCommand().register(program);
	registerImpactCommand(program);
	registerKernelCommand(program);
	registerScenariosCommand(program);
	registerExplainCommand(program);
	registerBudgetCommand(program);
	registerVerifyCommand(program);
	registerTaskCommand(program);
	new ModuleCommand().register(program);
	new ApiCommand().register(program);
	new PermissionsCommand().register(program);
	registerHistoryCommand(program);
	registerHooksCommand(program);
	registerConsoleCommand(program);
	registerAuditCommand(program);
	registerResponseCheckCommand(program);

	return program;
}

export async function runProgram(): Promise<void> {
	pipedOutput();
	const startedAt = Date.now();
	try {
		await buildProgram().exitOverride().parseAsync(process.argv);
	} catch (error) {
		if (error instanceof CommanderError) process.exitCode = error.exitCode;
		else {
			process.exitCode = 1;
			if (isExpectedCliError(error)) console.error(`Error: ${error.message}`);
			else throw error;
		}
	} finally {
		await recordAnalytics({
			kind: 'command',
			action: commandAction(process.argv.slice(2)),
			exitCode: Number(process.exitCode ?? 0),
			durationMs: Date.now() - startedAt
		});
		await beatFromEnvironment();
		if (process.argv[2] === 'loop') {
			try {
				await importAnalytics(process.cwd(), false);
			} catch {
				console.error('Warning: loop analytics could not be synchronized.');
			}
		}
	}
}
