import type { PermissionCatalog } from '../../services/networking-security/PermissionCatalogService.types';
import type { Command } from 'commander';
import { resolve } from 'node:path';
import { CommitTreeAdapter } from '../../adapters/git-source-history/CommitTreeAdapter';
import { PermissionCatalogService } from '../../services/networking-security/PermissionCatalogService';
import type { PermissionReadOptions } from './PermissionsCommand.types';
/** Read the same source-declared policy used by the API and profile pages. */
export class PermissionsCommand {
	register(program: Command): void {
		const permissions = this.options(
			program.command('permissions').description('Read declared user profiles and access grants.')
		);
		permissions
			.command('list')
			.action(async () => this.output('list', undefined, permissions.optsWithGlobals()));
		permissions
			.command('show <profile>')
			.action(async (id: string) => this.output('show', id, permissions.optsWithGlobals()));
	}
	registerApi(api: Command): void {
		const command = api
			.command('permissions [endpoint]')
			.description('Read declared endpoint methods and profile/data access from project source.')
			.option('--root <path>', 'Project directory; defaults to the current directory.');
		command.action(async (id: string | undefined) =>
			this.output('api', id, command.optsWithGlobals())
		);
	}
	private options(command: Command): Command {
		return command
			.option('--root <path>', 'Project directory; defaults to the current directory.')
			.option('--commit <sha>', 'Read this committed profile declaration snapshot.')
			.option('--branch <name>', 'Read this branch tip instead of the working tree.')
			.option('--json', 'Print JSON (the default).');
	}
	private async output(
		kind: 'list' | 'show' | 'api',
		id: string | undefined,
		options: PermissionReadOptions
	): Promise<void> {
		const root = resolve(options.root ?? process.cwd());
		const service = new PermissionCatalogService();
		const ref = options.commit ?? options.branch;
		const catalog = ref
			? await service.at(await CommitTreeAdapter.open(root, ref))
			: await service.load(root);
		const profile =
			kind === 'show' ? catalog.profiles.find((profile) => profile.id === id) : undefined;
		if (kind === 'show' && !profile) throw new Error(`Unknown permission profile: ${id}`);
		let result: unknown = catalog;
		if (kind === 'show') result = profile;
		if (kind === 'api') result = this.apiProfiles(catalog, id);
		console.log(JSON.stringify(result, null, 2));
		if (catalog.gaps.length) process.exitCode = 1;
	}
	private apiProfiles(catalog: PermissionCatalog, id?: string) {
		const profiles = catalog.profiles
			.map((profile) => ({
				...profile,
				grants: profile.grants.filter(
					(grant) => grant.kind === 'api' && (!id || grant.resource === id)
				)
			}))
			.filter((profile) => profile.grants.length);
		return { endpoint: id ?? null, profiles, gaps: catalog.gaps };
	}
}
