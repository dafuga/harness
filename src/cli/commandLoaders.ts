// @harness-uid u_wnr7fhxvwz
import type { Command } from 'commander';
/** Each loader registers one command family; no workflow is imported before selection. */
export const commandLoaders = {
	jobs: async (program: Command) => {
		const m = await import('../commands/execution-runtimes/JobsCommand');
		new m.JobsCommand().register(program);
	},
	codex: async (program: Command) => {
		const m = await import('./program/CodexCommand');
		m.registerCodexCommand(program);
	},
	provider: async (program: Command) => {
		const { ProviderSignInCommand } =
			await import('../commands/agents-providers/ProviderSignInCommand');
		new ProviderSignInCommand().register(program);
	},
	harbor: async (program: Command) => {
		const { HarborInspectionCommand } =
			await import('../commands/projects-sessions/HarborInspectionCommand');
		new HarborInspectionCommand().register(program);
	},
	benchmark: async (program: Command) => {
		const m = await import('./program/BenchmarkCommand');
		m.registerBenchmarkCommand(program);
	},
	resources: async (program: Command) => {
		const m = await import('./program/ResourcesCommand');
		m.registerResourcesCommand(program);
	},
	analytics: async (program: Command) => {
		const m = await import('./program/AnalyticsCommand');
		m.registerAnalyticsCommand(program);
	},
	activity: async (program: Command) => {
		const m = await import('./program/ActivityCommand');
		m.registerActivityCommand(program);
	},
	projects: async (program: Command) => {
		const { ProjectListCommand } = await import('../commands/projects-sessions/ProjectListCommand');
		new ProjectListCommand().register(program);
	},
	report: async (program: Command) => {
		const m = await import('./program/ReportCommand');
		m.registerReportCommand(program);
	},
	new: async (program: Command) => {
		const m = await import('./program/new');
		m.registerNewCommand(program);
	},
	generate: async (program: Command) => {
		const m = await import('./program/generate');
		m.registerGenerateCommand(program);
	},
	info: async (program: Command) => {
		const m = await import('./program/info');
		m.registerInfoCommand(program);
	},
	loop: async (program: Command) => {
		const m = await import('./program/loop');
		m.registerLoopCommand(program);
	},
	units: async (program: Command) => {
		const m = await import('./program/UnitsCommand');
		m.registerUnitsCommand(program);
	},
	contracts: async (program: Command) => {
		const m = await import('../commands/development-tooling/ContractsCommand');
		new m.ContractsCommand().register(program);
	},
	impact: async (program: Command) => {
		const m = await import('./program/ImpactCommand');
		m.registerImpactCommand(program);
	},
	kernel: async (program: Command) => {
		const m = await import('./program/KernelCommand');
		m.registerKernelCommand(program);
	},
	scenarios: async (program: Command) => {
		const m = await import('./program/ScenariosCommand');
		m.registerScenariosCommand(program);
	},
	explain: async (program: Command) => {
		const m = await import('./program/ExplainCommand');
		m.registerExplainCommand(program);
	},
	budget: async (program: Command) => {
		const m = await import('./program/BudgetCommand');
		m.registerBudgetCommand(program);
	},
	verify: async (program: Command) => {
		const m = await import('./program/VerifyCommand');
		m.registerVerifyCommand(program);
	},
	task: async (program: Command) => {
		const m = await import('./program/TaskCommand');
		m.registerTaskCommand(program);
	},
	tracker: async (program: Command) => {
		const { TrackerCommand } = await import('../commands/projects-sessions/TrackerCommand');
		new TrackerCommand().register(program);
	},
	deploy: async (program: Command) => {
		const m = await import('../commands/execution-runtimes/DeployCommand');
		new m.DeployCommand().register(program);
	},
	module: async (program: Command) => {
		const m = await import('./../commands/module-system/ModuleCommand');
		new m.ModuleCommand().register(program);
	},
	api: async (program: Command) => {
		const m = await import('./../commands/networking-security/ApiCommand');
		new m.ApiCommand().register(program);
	},
	credential: async (program: Command) => {
		const m = await import('./../commands/accounts-access/CredentialCommand');
		new m.CredentialCommand().register(program);
	},
	permissions: async (program: Command) => {
		const m = await import('./../commands/networking-security/PermissionsCommand');
		new m.PermissionsCommand().register(program);
	},
	history: async (program: Command) => {
		const m = await import('./program/HistoryCommand');
		m.registerHistoryCommand(program);
	},
	hooks: async (program: Command) => {
		const m = await import('./program/HooksCommand');
		m.registerHooksCommand(program);
	},
	console: async (program: Command) => {
		const m = await import('./program/ConsoleCommand');
		m.registerConsoleCommand(program);
	},
	audit: async (program: Command) => {
		const m = await import('./program/audit');
		m.registerAuditCommand(program);
	},
	design: async (program: Command) => {
		const m = await import('../commands/planning-collaboration/DesignCommand');
		new m.DesignCommand().register(program);
	},
	assistant: async (program: Command) => {
		const m = await import('../commands/agents-providers/AssistantCommand');
		new m.AssistantCommand().register(program);
	},
	'qa-sync': async (program: Command) => {
		const m = await import('../commands/agents-providers/QaSyncCommand');
		new m.QaSyncCommand().register(program);
	},
	'container-browser': async (program: Command) => {
		const m = await import('../commands/execution-runtimes/ContainerBrowserCommand');
		new m.ContainerBrowserCommand().register(program);
	},
	'x-digest': async (program: Command) => {
		const m = await import('../commands/agents-providers/XDigestCommand');
		new m.XDigestCommand().register(program);
	},
	'response-check': async (program: Command) => {
		const m = await import('./program/ResponseCheckCommand');
		m.registerResponseCheckCommand(program);
	}
};
