import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { PermissionCatalog, PermissionSourceTree } from './PermissionCatalogService.types';
const text = z.string().trim().min(1);
const data = z.strictObject({
	resource: text,
	actions: z.array(z.enum(['read', 'create', 'update', 'delete'])).min(1),
	fields: z.array(text).min(1),
	scope: text
});
export const profileSchema = z.strictObject({
	schemaVersion: z.literal(1),
	id: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
	title: text,
	description: text,
	grants: z.array(
		z.discriminatedUnion('kind', [
			z.strictObject({
				kind: z.literal('api'),
				resource: text,
				actions: z
					.array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']))
					.min(1),
				data: z.array(data)
			}),
			z.strictObject({
				kind: z.literal('page'),
				resource: text,
				actions: z.tuple([z.literal('view')])
			}),
			data.extend({ kind: z.literal('data') })
		])
	)
});
/** Read declared user profiles without executing project code or assuming undeclared access. */
export class PermissionCatalogService {
	async load(root: string): Promise<PermissionCatalog> {
		return this.at({
			read: (path) => readFile(join(root, path), 'utf8'),
			list: async () =>
				(await this.files(root)).map((name) => ({ path: `specification/permissions/${name}` }))
		});
	}
	async at(tree: PermissionSourceTree): Promise<PermissionCatalog> {
		const catalog: PermissionCatalog = { profiles: [], gaps: [] };
		for (const { path } of await tree.list()) {
			const match = /^specification\/permissions\/([a-z][a-z0-9-]*)\.json$/.exec(path);
			if (!match) continue;
			try {
				const profile = profileSchema.parse(JSON.parse(await tree.read(path)));
				if (profile.id !== match[1])
					throw new Error('Profile identity does not match its source file.');
				if (catalog.profiles.some((entry) => entry.id === profile.id))
					throw new Error('Duplicate profile identity.');
				catalog.profiles.push({ ...profile, source: path });
			} catch {
				catalog.gaps.push(`Invalid permission profile: ${path}`);
			}
		}
		catalog.profiles.sort((a, b) => a.id.localeCompare(b.id));
		return catalog;
	}
	private async files(root: string): Promise<string[]> {
		try {
			return await readdir(join(root, 'specification/permissions'));
		} catch (error) {
			if ((error as { code?: string }).code === 'ENOENT') return [];
			throw error;
		}
	}
}
