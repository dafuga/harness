// @harness-uid u_3tibsmkofv
import { DeployCommand } from '../commands/execution-runtimes/DeployCommand';
import { PermissionsCommand } from '../commands/networking-security/PermissionsCommand';
import { AssistantCommand } from '../commands/agents-providers/AssistantCommand';
import { QaSyncCommand } from '../commands/agents-providers/QaSyncCommand';
import { XDigestCommand } from '../commands/agents-providers/XDigestCommand';
import { ContainerBrowserCommand } from '../commands/execution-runtimes/ContainerBrowserCommand';
import { DesignCommand } from '../commands/planning-collaboration/DesignCommand';
import { ContractsCommand } from '../commands/development-tooling/ContractsCommand';
import { ProviderSignInCommand } from '../commands/agents-providers/ProviderSignInCommand';
import { registerTaskCommand } from './program/TaskCommand';
import { TrackerCommand } from '../commands/projects-sessions/TrackerCommand';
import { ModuleCommand } from '../commands/module-system/ModuleCommand';
import { ApiCommand } from '../commands/networking-security/ApiCommand';
import { sdkPackage } from '../utils/development-tooling/buildStamp';
import { registerCodexCommand } from './program/CodexCommand';
import { registerBenchmarkCommand } from './program/BenchmarkCommand';
import { registerAnalyticsCommand } from './program/AnalyticsCommand';
import { registerActivityCommand } from './program/ActivityCommand';
import { ProjectListCommand } from '../commands/projects-sessions/ProjectListCommand';
import { HarborInspectionCommand } from '../commands/projects-sessions/HarborInspectionCommand';
import { registerReportCommand } from './program/ReportCommand';
import { registerResourcesCommand } from './program/ResourcesCommand';
import { Command } from 'commander';
import { JobsCommand } from '../commands/execution-runtimes/JobsCommand';
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
	new ProviderSignInCommand().register(program);
	new HarborInspectionCommand().register(program);
	registerBenchmarkCommand(program);
	registerResourcesCommand(program);
	new JobsCommand().register(program);
	registerAnalyticsCommand(program);
	registerActivityCommand(program);
	new ProjectListCommand().register(program);
	registerReportCommand(program);
	registerNewCommand(program);
	registerGenerateCommand(program);
	registerInfoCommand(program);
	registerLoopCommand(program);
	registerUnitsCommand(program);
	new ContractsCommand().register(program);
	registerImpactCommand(program);
	registerKernelCommand(program);
	registerScenariosCommand(program);
	registerExplainCommand(program);
	registerBudgetCommand(program);
	registerVerifyCommand(program);
	registerTaskCommand(program);
	new TrackerCommand().register(program);
	new DeployCommand().register(program);
	new ModuleCommand().register(program);
	new ApiCommand().register(program);
	new PermissionsCommand().register(program);
	registerHistoryCommand(program);
	registerHooksCommand(program);
	registerConsoleCommand(program);
	registerAuditCommand(program);
	new DesignCommand().register(program);
	new AssistantCommand().register(program);
	new QaSyncCommand().register(program);
	new ContainerBrowserCommand().register(program);
	new XDigestCommand().register(program);
	registerResponseCheckCommand(program);

	return program;
}
