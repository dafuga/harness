import { categories } from '../../models/development-tooling/Desktop.types';
import type { Category } from '../../models/development-tooling/Desktop.types';
export interface RendererRoute {
	branch: string | null;
	commit: string | null;
	category: Category;
	entityId: string | null;
	tab: string | null;
}
export function rendererPath(path: string): RendererRoute {
	const parts = path.split('/').filter(Boolean);
	const result: RendererRoute = {
		branch: null,
		commit: null,
		category: 'pages',
		entityId: null,
		tab: null
	};
	if (parts[0] !== 'harness' || parts[1] !== 'branch') return result;
	result.branch = decodeURIComponent(parts[2] ?? '');
	let index = 3;
	if (parts[index] === 'commit') {
		result.commit = parts[index + 1] ?? null;
		index += 2;
	}
	if (categories.includes(parts[index] as Category)) result.category = parts[index] as Category;
	result.entityId = parts[index + 1] ? decodeURIComponent(parts[index + 1]) : null;
	result.tab = parts[index + 2] ?? null;
	return result;
}
