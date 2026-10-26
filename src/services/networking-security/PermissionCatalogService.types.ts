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
