import type { AuditFile } from './adapters/types';
import type { AuditFinding } from './types';

export function fileName(path: string): string {
	return path.split('/').at(-1) ?? '';
}

export function typeScriptStem(path: string): string {
	return fileName(path).replace(/\.[tj]sx?$/, '');
}

export function fileNameFinding(file: AuditFile, message: string): AuditFinding {
	return { path: file.relativePath, rule: 'file-name-pattern', message };
}

export function isPascalCase(value: string): boolean {
	return /^[A-Z][A-Za-z0-9]*$/.test(value);
}

export function isCamelCase(value: string): boolean {
	return /^[a-z][A-Za-z0-9]*$/.test(value);
}

export function isKebabCase(value: string): boolean {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
