import type { Page } from '@playwright/test';
import type { ExplorerLocation } from '../src/models/Explorer.types';
import { commits, ids } from './entityUnits';
/** True when the open tooltip lies wholly inside the window. */
export async function inside(tab: Page, size: { width: number; height: number }): Promise<boolean> {
	const box = (await tab.getByRole('tooltip').boundingBox()) ?? {
		x: -1,
		y: -1,
		width: 0,
		height: 0
	};
	const across = box.x >= 0 && box.x + box.width <= size.width;
	return across && box.y >= 0 && box.y + box.height <= size.height;
}

export const responsiveRoutes: Partial<ExplorerLocation>[] = [
	{},
	{ category: 'services' as const, commit: commits.middle },
	{ category: 'pages', entity: ids.page, commit: commits.middle },
	{ category: 'functions', entity: ids.filter, commit: commits.middle },
	{
		category: 'functions',
		entity: ids.filter,
		section: 'history' as const,
		commit: commits.middle
	},
	{ category: 'pages', entity: ids.page, tab: 'source' as const },
	{ category: 'configs' as const, entity: ids.settings }
];
