import type { Category } from '../../models/development-tooling/Desktop.types';
export function categoryOf(kind: string): Category | null {
	const kinds: Record<string, Category> = {
		page: 'pages',
		// Declared on the manifest; an id or a file name never makes a unit a shell.
		shell: 'shells',
		component: 'components',
		function: 'functions',
		'shared-function': 'functions',
		config: 'configs',
		service: 'services',
		model: 'models'
	};
	return kinds[kind] ?? null;
}
