import { auditArchitecture } from '../architectureRules';
import { auditBlocks } from '../blockRules';
import { auditClassCount, auditFileLength } from '../commonRules';
import { auditTypeScriptNaming } from '../namingRules';
import type { AuditAdapter, AuditFile } from './types';

export const typeScriptAdapter: AuditAdapter = {
	id: 'typescript',
	label: 'TypeScript and JavaScript',
	profiles: ['app', 'lib'],
	extensions: ['.ts', '.tsx', '.js', '.jsx'],
	optionalTools: ['eslint'],
	audit(file) {
		return [
			...auditFileLength(file.relativePath, file.lines),
			...auditClassCount(file.relativePath, file.structuralLines),
			...auditBlocks(file.relativePath, file.structuralLines),
			...auditArchitecture(file.relativePath, file.structuralLines),
			...auditTypeScriptNaming(file),
			...auditReactComponentName(file)
		];
	}
};

function auditReactComponentName(file: AuditFile) {
	if (!['.tsx', '.jsx'].includes(file.extension)) return [];
	const name =
		file.relativePath
			.split('/')
			.at(-1)
			?.replace(/\.[tj]sx$/, '') ?? '';
	if (!name || /^[A-Z][A-Za-z0-9]*$/.test(name) || name.includes('.')) return [];

	return [
		{
			path: file.relativePath,
			rule: 'react-component-name',
			message: 'TSX/JSX component files should use PascalCase names.'
		}
	];
}
