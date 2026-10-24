import type { Category } from '../../models/development-tooling/Desktop.types';
export function categoryOf(kind: string): Category | null {
	const kinds: Record<string, Category> = {
		page: 'pages',
		endpoint: 'apis',
		api: 'apis',
		// Declared on the manifest; an id or a file name never makes a unit a shell.
		shell: 'components',
		layout: 'layouts',
		component: 'components',
		function: 'functions',
		'shared-function': 'functions',
		config: 'configs',
		service: 'services',
		model: 'models'
	};
	return kinds[kind] ?? null;
}
