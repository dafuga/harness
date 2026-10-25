import type { Command } from 'commander';
import { ModuleCatalogService } from '../../services/module-system/ModuleCatalogService';
import { ModuleInstallService } from '../../services/module-system/ModuleInstallService';
import { ModuleResourceService } from '../../services/module-system/ModuleResourceService';

/** Discover module instructions and delegate all mutations to the shared generation boundary. */
export class ModuleCommand {
	register(program: Command): void {
		const module = program.command('module').description('Discover and add project capabilities.');
		this.discovery(module);
		this.instructions(module);
		module
			.command('add <id>')
			.description('Install module code, dependencies and instructions.')
			.action(async (id: string) => {
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
			.option('--group <group>', 'Responsibility category for a standard scaffold.')
			.action(async (id: string, type: string, name: string, options: { group?: string }) => {
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

	private discovery(module: Command): void {
		module
			.command('list')
			.option('--json', 'Print module definitions and installation state.')
			.action(async (options: { json?: boolean }) => {
				const catalog = await new ModuleCatalogService().load(process.cwd());
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
				const catalog = await new ModuleCatalogService().load(process.cwd());
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
										`${resource.title}: harness module generate ${id} ${resource.id} Example\n${resource.instructions.join('\n')}`
								)
							].join('\n\n')
				);
			});
	}
}
