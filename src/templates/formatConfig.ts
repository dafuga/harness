import type { PlannedFile } from '../core/files';

export function formatConfigFiles(): PlannedFile[] {
	return [
		{
			path: '.prettierrc',
			contents:
				'{\n\t"useTabs": true,\n\t"singleQuote": true,\n\t"trailingComma": "none",\n\t"printWidth": 100\n}\n'
		},
		{
			path: '.prettierignore',
			contents:
				'node_modules\ndist\ncoverage\n.svelte-kit\nbuild\n*.cpp\n*.h\n*.hpp\n*.py\n*.sh\n*.wasm\n'
		}
	];
}
