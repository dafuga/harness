import { TestingPluginService } from './module-command/TestingPluginService';
import type { Command } from 'commander';
import { ModuleCatalogService } from '../../services/module-system/ModuleCatalogService';
import { ModuleInstallService } from '../../services/module-system/ModuleInstallService';
import { ModuleResourceService } from '../../services/module-system/ModuleResourceService';
/** Discover module instructions and delegate all mutations to the shared generation boundary. */
export class ModuleCommand {
	register(program: Command): void {
		this.group(program.command('module').description('Discover and add project capabilities.'));
		const plugin = program
			.command('plugin')
			.description('Discover external capability and testing plugins.');
		this.group(plugin);
		plugin
			.command('test <id> [args...]')
			.allowUnknownOption()
			.description('Run an installed testing plugin headlessly.')
			.action((id: string, args: string[]) => this.test(id, args));
	}
	private group(module: Command): void {
		this.discovery(module);
		this.instructions(module);
		module
			.command('add <id>')
			.description('Install module code, dependencies and instructions.')
			.action(async (id: string) => {
				if (!(await this.catalog(module)).modules.some((entry) => entry.definition.id === id))
					throw new Error(`Unknown plugin: ${id}`);
				const files = await new ModuleInstallService().add(process.cwd(), id);
				console.log(
					files.length
						? `Added ${id}.\n${files.join('\n')}\nRun bun install, then follow specification/modules/${id}/README.md.`
						: `${id} is already installed.`
				);
			});
		module
			.command('generate <module> <type> <name>')
			.description('Generate a resource declared by an installed module.')
			.option('--group <group>', 'Responsibility category for the module generator.')
			.action(async (id: string, type: string, name: string, options: { group?: string }) => {
				if (!(await this.catalog(module)).modules.some((entry) => entry.definition.id === id))
					throw new Error(`Unknown plugin: ${id}`);
				console.log(
					(
						await new ModuleResourceService().generate(process.cwd(), id, type, {
							name,
							group: options.group
						})
					).join('\n')
				);
			});
	}
	private async test(id: string, args: string[]): Promise<void> {
		const abort = new AbortController();
		const cancel = () => abort.abort(new Error('Testing plugin cancelled.'));
		process.once('SIGINT', cancel);
		process.once('SIGTERM', cancel);
		try {
			process.exitCode = await new TestingPluginService().run(
				process.cwd(),
				id,
				args,
				abort.signal
			);
		} finally {
			process.removeListener('SIGINT', cancel);
			process.removeListener('SIGTERM', cancel);
		}
	}
	private async catalog(command: Command) {
		const catalog = await new ModuleCatalogService().load(process.cwd());
		return command.name() === 'plugin'
			? {
					...catalog,
					modules: catalog.modules.filter(
						(entry) =>
							entry.definition.visibility !== 'internal' &&
							(entry.source !== 'builtin' ||
								!entry.definition.includedByDefault ||
								entry.definition.testing)
					)
				}
			: catalog;
	}
	private discovery(module: Command): void {
		module
			.command('list')
			.option('--json', 'Print module definitions and installation state.')
			.action(async (options: { json?: boolean }) => {
				const catalog = await this.catalog(module);
				if (options.json) console.log(JSON.stringify(catalog, null, 2));
				else {
					for (const entry of catalog.modules)
						console.log(
							`${entry.definition.id}: ${entry.definition.title} (${entry.installed ? 'installed' : 'available'}) — ${entry.definition.description}`
						);
					for (const gap of catalog.gaps) console.error(gap);
				}
				if (catalog.gaps.length) process.exitCode = 1;
			});
	}
	private instructions(module: Command): void {
		module
			.command('info <id>')
			.option('--json', 'Print generator instructions.')
			.action(async (id: string, options: { json?: boolean }) => {
				const catalog = await this.catalog(module);
				const entry = catalog.modules.find((item) => item.definition.id === id);
				if (!entry) throw new Error(`Unknown module: ${id}`);
				console.log(
					options.json
						? JSON.stringify(entry, null, 2)
						: [
								entry.definition.title,
								entry.definition.description,
								...entry.definition.instructions,
								...entry.definition.resources.map(
									(resource) =>
										`${resource.title}: harness ${module.name()} generate ${id} ${resource.id} Example\n${resource.instructions.join('\n')}`
								)
							].join('\n\n')
				);
			});
	}
}
