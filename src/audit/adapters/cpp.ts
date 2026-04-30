import { auditFileLength } from '../commonRules';
import { auditCurlyFunctions } from './blockHelpers';
import type { AuditAdapter, AuditFile } from './types';

const cppExtensions = ['.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx'];

export const cppAdapter: AuditAdapter = {
	id: 'cpp',
	label: 'C and C++',
	profiles: ['lib'],
	extensions: cppExtensions,
	optionalTools: ['clang-tidy', 'clang-format'],
	audit(file) {
		return [
			...auditFileLength(file.relativePath, file.lines),
			...auditCurlyFunctions(file.relativePath, file.structuralLines, startsCppFunction),
			...auditHeaderNamespace(file),
			...auditRelativeInclude(file)
		];
	}
};

function startsCppFunction(line: string): boolean {
	if (/^\s*(if|for|while|switch|catch)\b/.test(line)) return false;
	return /^\s*(?:[\w:<>,~*&\s]+\s+)+[\w:~]+\s*\([^;]*\)\s*(const\s*)?(noexcept\s*)?\{/.test(line);
}

function auditHeaderNamespace(file: AuditFile) {
	if (
		!['.h', '.hh', '.hpp', '.hxx'].includes(file.extension) ||
		!/\busing\s+namespace\s+std\s*;/.test(file.contents)
	)
		return [];

	return [
		{
			path: file.relativePath,
			rule: 'cpp-header-namespace',
			message: 'Header files should not export using namespace std.'
		}
	];
}

function auditRelativeInclude(file: AuditFile) {
	if (!file.lines.some((line) => /^\s*#include\s+["']\.\.\//.test(line))) return [];
	return [
		{
			path: file.relativePath,
			rule: 'cpp-include-direction',
			message: 'Avoid parent-directory includes in C/C++ files.'
		}
	];
}
