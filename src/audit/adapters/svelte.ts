import { auditBlocks } from '../blockRules';
import { auditFileLength } from '../commonRules';
import type { AuditAdapter, AuditFile } from './types';

const routeFiles = new Set(['+page', '+layout', '+error']);

export const svelteAdapter: AuditAdapter = {
	id: 'svelte',
	label: 'Svelte',
	profiles: ['app'],
	extensions: ['.svelte'],
	optionalTools: ['svelte-check', 'eslint'],
	audit(file) {
		const script = scriptContents(file.contents);
		return [
			...auditFileLength(file.relativePath, file.lines),
			...auditScriptLanguage(file),
			...auditSveltePath(file),
			...(script ? auditBlocks(file.relativePath, script.split('\n')) : [])
		];
	}
};

function auditScriptLanguage(file: AuditFile) {
	if (!/<script\b/.test(file.contents) || /<script\s+lang="ts"/.test(file.contents)) return [];

	return [
		{
			path: file.relativePath,
			rule: 'svelte-script-lang',
			message: 'Svelte script blocks should use lang="ts".'
		}
	];
}

function auditSveltePath(file: AuditFile) {
	const name = file.relativePath.split('/').at(-1)?.replace('.svelte', '') ?? '';
	if (file.relativePath.startsWith('src/routes/') && !routeFiles.has(name)) {
		return [{ path: file.relativePath, rule: 'svelte-route-file', message: 'Route Svelte files should use +page, +layout, or +error.' }];
	}

	if (file.relativePath.startsWith('src/components/') && !/^[A-Z][A-Za-z0-9]*$/.test(name)) {
		return [{ path: file.relativePath, rule: 'svelte-component-name', message: 'Component files should use PascalCase names.' }];
	}

	return [];
}

function scriptContents(contents: string): string | undefined {
	return contents.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];
}
