import type { AdapterCoverage } from '../../src/audit/development-tooling/adapters/types';

export function typescriptAdapter(files: string[]): AdapterCoverage {
	return {
		id: 'typescript',
		label: 'TypeScript and JavaScript',
		files,
		extensions: ['.ts', '.tsx', '.js', '.jsx'],
		optionalTools: ['eslint']
	};
}

export const svelte: AdapterCoverage = {
	id: 'svelte',
	label: 'Svelte',
	files: ['src/routes/+page.svelte', 'src/lib/Nav.svelte'],
	extensions: ['.svelte'],
	optionalTools: ['svelte-check', 'eslint']
};

export const sql: AdapterCoverage = {
	id: 'sql',
	label: 'SQL',
	files: [],
	extensions: ['.sql'],
	optionalTools: ['sqlfluff']
};

export const shell: AdapterCoverage = {
	id: 'shell',
	label: 'Shell',
	files: ['scripts/clean.sh', 'scripts/deploy.sh'],
	extensions: ['.sh'],
	optionalTools: ['shellcheck']
};

export const findingsAdapters = [
	typescriptAdapter(['src/services/OrderService.ts', 'src/components/profileCard.tsx']),
	svelte,
	sql,
	shell
];
