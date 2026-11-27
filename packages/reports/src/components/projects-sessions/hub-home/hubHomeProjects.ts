// @harness-uid u_xdo57l4rk2
import type { ProjectSnapshot } from '../../../../../desktop/src/models/development-tooling/Desktop.types';
import { count } from './hubHomePresentation';

export function projectInventory(snapshot: ProjectSnapshot) {
	const pages = snapshot.entities.filter((entity) => entity.category === 'pages');
	const components = snapshot.entities.filter((entity) => entity.category === 'components');
	const groups = new Map<string, { pages: number; components: number }>();
	for (const entity of [...pages, ...components]) {
		const parts = entity.id.split('.');
		const name = parts.length >= 3 ? parts[0] : snapshot.project.name;
		const counts = groups.get(name) ?? { pages: 0, components: 0 };
		if (entity.category === 'pages') counts.pages++;
		else counts.components++;
		groups.set(name, counts);
	}
	return { pages, components, apps: [...groups] };
}

export function inventorySummary(inventory: ReturnType<typeof projectInventory>) {
	return [
		count(inventory.apps.length, 'app'),
		count(inventory.pages.length, 'page'),
		count(inventory.components.length, 'component')
	].join(' · ');
}
