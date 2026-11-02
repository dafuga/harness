// @harness-uid u_g67t5ir5f2
import type { Category } from '../../models/development-tooling/Desktop.types';

export interface RendererRoute {
	branch: string | null;
	commit: string | null;
	category: Category;
	entityId: string | null;
	tab: string | null;
}
