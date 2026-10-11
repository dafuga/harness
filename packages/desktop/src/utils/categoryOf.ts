import type { Category } from '../models/Desktop.types';
export function categoryOf(kind: string): Category | null {
	const kinds: Record<string, Category> = {
		page: 'pages',
		component: 'components',
		function: 'functions',
		'shared-function': 'functions',
		config: 'configs',
		service: 'services'
	};
	return kinds[kind] ?? null;
}
