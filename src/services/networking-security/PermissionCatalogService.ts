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
	async load(_root: string): Promise<PermissionCatalog> {
		return { profiles: [], gaps: [] };
	}
	async at(_tree: PermissionSourceTree): Promise<PermissionCatalog> {
		return { profiles: [], gaps: [] };
	}
}
