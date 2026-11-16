// @harness-uid u_jpdkjh3qxl
import type { z } from 'zod';
import type { profileSchema } from './PermissionCatalogService';
export type PermissionProfile = z.infer<typeof profileSchema>;
export interface PermissionCatalog {
	profiles: Array<PermissionProfile & { source: string }>;
	gaps: string[];
}
export interface PermissionSourceTree {
	read(path: string): Promise<string>;
	list(): Promise<Array<{ path: string }>>;
}
/** A permission profile whose id differs from its source filename or repeats another profile's id. */
export class ProfileIdentityError extends Error {
	override name = 'ProfileIdentityError';
}
