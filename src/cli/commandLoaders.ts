// @harness-uid u_wnr7fhxvwz
import type { Command } from 'commander';
/** Each loader registers one command family; no workflow is imported before selection. */
export const commandLoaders = {
	codex: async (program: Command) => {
		const m = await import('./program/CodexCommand');
		m.registerCodexCommand(program);
	},
	provider: async (program: Command) => {
		const { ProviderSignInCommand } =
			await import('../commands/agents-providers/ProviderSignInCommand');
		new ProviderSignInCommand().register(program);
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
	module: async (program: Command) => {
		const m = await import('./../commands/module-system/ModuleCommand');
		new m.ModuleCommand().register(program);
	},
	api: async (program: Command) => {
		const m = await import('./../commands/networking-security/ApiCommand');
		new m.ApiCommand().register(program);
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
	'response-check': async (program: Command) => {
		const m = await import('./program/ResponseCheckCommand');
		m.registerResponseCheckCommand(program);
	}
};
