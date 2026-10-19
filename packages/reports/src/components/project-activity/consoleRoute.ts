import type { ConsoleRoute } from '../../../../../src/utils/consoleRoute';

const encode = (text: string) => text.split('/').map(encodeURIComponent).join('/');

/** The canonical path of a console page; every part is encoded, slashes of a branch are kept. */
export function consoleRoutePath(route: ConsoleRoute): string {
	const branch = route.branch === null ? '' : `/branch/${encode(route.branch)}`;
	const base = route.view === 'compare' && route.base ? `/${route.base}` : '';
	const record =
		route.view === 'history' && route.record ? `/record/${encodeURIComponent(route.record)}` : '';
	const unit = route.unit ? `/unit/${encodeURIComponent(route.unit)}` : '';
	return `${branch}/commit/${route.commit}/${route.view}${base}${record}${unit}`;
}
