import { toCamelCase, toPascalCase } from '../core/case';
import type { AuditFile } from './adapters/types';
import { hasNamedValueExport } from './functionNamingRules';
import {
	fileNameFinding,
	isCamelCase,
	isKebabCase,
	isPascalCase,
	typeScriptStem
} from './namePatterns';
import type { AuditFinding } from './types';

interface ClassFileRule {
	folder: string;
	suffix: string;
	label: string;
}

interface FunctionFileRule {
	expected: string;
	label: string;
	validFileName: boolean;
	filePattern: string;
}

const classFileRules: ClassFileRule[] = [
	{ folder: 'controllers', suffix: 'Controller', label: 'Controller' },
	{ folder: 'services', suffix: 'Service', label: 'Service' },
	{ folder: 'decorators', suffix: 'Decorator', label: 'Decorator' },
	{ folder: 'adapters', suffix: 'Adapter', label: 'Adapter' },
	{ folder: 'repositories', suffix: 'Repository', label: 'Repository' },
	{ folder: 'validators', suffix: 'Validator', label: 'Validator' },
	{ folder: 'serializers', suffix: 'Serializer', label: 'Serializer' },
	{ folder: 'policies', suffix: 'Policy', label: 'Policy' },
	{ folder: 'jobs', suffix: 'Job', label: 'Job' },
	{ folder: 'notifications', suffix: 'Notification', label: 'Notification' },
	{ folder: 'commands', suffix: 'Command', label: 'Command' },
	{ folder: 'mailers', suffix: 'Mailer', label: 'Mailer' },
	{ folder: 'helpers', suffix: 'Helper', label: 'Helper' },
	{ folder: 'channels', suffix: 'Channel', label: 'Channel' },
	{ folder: 'forms', suffix: 'Form', label: 'Form' },
	{ folder: 'middleware', suffix: 'Middleware', label: 'Middleware' }
];

const modelAdapters: Record<string, string> = {
	d1: 'createD1Adapter',
	postgres: 'createPostgresAdapter',
	sqlite: 'createSqliteAdapter'
};

export function auditScaffoldTypeScriptNaming(file: AuditFile): AuditFinding[] {
	return [
		...auditClassFileName(file),
		...auditModelFileName(file),
		...auditGeneratedFunctionFile(file),
		...auditConfigFileName(file),
		...auditTestFileName(file),
		...auditE2eFileName(file)
	];
}

function auditClassFileName(file: AuditFile): AuditFinding[] {
	const rule = classRuleForPath(file.relativePath);
	if (!rule) return [];
	const className = exportedClassNames(file.structuralLines)[0];
	if (!className) return [];
	const stem = typeScriptStem(file.relativePath);
	if (stem === className && isPascalWithSuffix(className, rule.suffix)) return [];
	return [
		fileNameFinding(
			file,
			`${rule.label} files should be named <PascalName>${rule.suffix}.ts and match the exported class.`
		)
	];
}

function auditModelFileName(file: AuditFile): AuditFinding[] {
	const path = file.relativePath;
	if (!path.startsWith('src/models/') || path.startsWith('src/models/adapters/')) return [];
	const modelName = typeScriptStem(path).replace(/\.types$/, '');
	if (isPascalCase(modelName)) return [];
	return [
		fileNameFinding(file, 'Model files should be named <PascalName>.ts or <PascalName>.types.ts.')
	];
}

function auditGeneratedFunctionFile(file: AuditFile): AuditFinding[] {
	const rule = functionFileRule(file);
	if (!rule) return [];
	const findings = rule.validFileName
		? []
		: [fileNameFinding(file, `${rule.label} files should be named ${rule.filePattern}.`)];
	if (hasNamedValueExport(file.structuralLines, rule.expected)) return findings;
	return [
		...findings,
		{
			path: file.relativePath,
			rule: 'function-name-pattern',
			message: `${rule.label} files should export "${rule.expected}".`
		}
	];
}

function auditConfigFileName(file: AuditFile): AuditFinding[] {
	if (!file.relativePath.startsWith('src/config/')) return [];
	if (/^[a-z][A-Za-z0-9]*Config$/.test(typeScriptStem(file.relativePath))) return [];
	return [fileNameFinding(file, 'Config files should be named <camelName>Config.ts.')];
}

function auditTestFileName(file: AuditFile): AuditFinding[] {
	const stem = typeScriptStem(file.relativePath);
	if (!file.relativePath.startsWith('test/') || !stem.endsWith('.test')) return [];
	if (/^[a-z0-9]+(?:[-.][a-z0-9]+)*\.test$/.test(stem)) return [];
	return [
		fileNameFinding(file, 'Test files should use lowercase kebab-case names ending in .test.ts.')
	];
}

function auditE2eFileName(file: AuditFile): AuditFinding[] {
	const stem = typeScriptStem(file.relativePath);
	if (!file.relativePath.startsWith('tests/e2e/') || !stem.endsWith('.spec')) return [];
	if (/^[a-z0-9]+(?:-[a-z0-9]+)*\.spec$/.test(stem)) return [];
	return [
		fileNameFinding(file, 'E2E specs should use lowercase kebab-case names ending in .spec.ts.')
	];
}

function functionFileRule(file: AuditFile): FunctionFileRule | undefined {
	const path = file.relativePath;
	const stem = typeScriptStem(path);
	if (path.startsWith('src/utils/')) return camelFunctionRule(stem, 'Utility', '<camelName>.ts');
	if (path.startsWith('src/concerns/')) return prefixedRule(stem, 'with', 'Concern');
	if (path.startsWith('src/initializers/')) return prefixedRule(stem, 'initialize', 'Initializer');
	if (path.startsWith('src/hooks/')) return hookRule(stem);
	if (path.startsWith('src/lib/stores/')) return storeRule(stem);
	if (path.startsWith('db/seed-data/')) return seedRule(stem);
	if (path.startsWith('src/models/adapters/')) return modelAdapterRule(stem);
	return undefined;
}

function camelFunctionRule(stem: string, label: string, filePattern: string): FunctionFileRule {
	return { expected: toCamelCase(stem), label, validFileName: isCamelCase(stem), filePattern };
}

function prefixedRule(stem: string, prefix: string, label: string): FunctionFileRule {
	const unprefixed = stem.startsWith(prefix) ? stem.slice(prefix.length) : stem;
	const expected = `${prefix}${toPascalCase(unprefixed)}`;
	return {
		expected,
		label,
		validFileName: stem === expected,
		filePattern: `${prefix}<PascalName>.ts`
	};
}

function hookRule(stem: string): FunctionFileRule {
	const exportName = stem.replace(/\.server$/, '');
	const rawName = exportName.endsWith('Hook') ? exportName.slice(0, -4) : exportName;
	const expected = `${toCamelCase(rawName)}Hook`;
	return {
		expected,
		label: 'Hook',
		validFileName: stem === `${expected}.server`,
		filePattern: '<camelName>Hook.server.ts'
	};
}

function storeRule(stem: string): FunctionFileRule {
	const storeName = stem.replace(/\.svelte$/, '');
	const expected = `create${toPascalCase(storeName)}Store`;
	return {
		expected,
		label: 'Store',
		validFileName: isCamelCase(storeName) && stem.endsWith('.svelte'),
		filePattern: '<camelName>.svelte.ts'
	};
}

function seedRule(stem: string): FunctionFileRule {
	return {
		expected: `seed${toPascalCase(stem)}`,
		label: 'Seeder',
		validFileName: isKebabCase(stem),
		filePattern: '<kebab-name>.ts'
	};
}

function modelAdapterRule(stem: string): FunctionFileRule | undefined {
	const expected = modelAdapters[stem];
	if (!expected) return undefined;
	return { expected, label: 'Model adapter', validFileName: true, filePattern: '<adapter>.ts' };
}

function exportedClassNames(lines: string[]): string[] {
	return lines.flatMap((line) => line.match(/^\s*export\s+class\s+([A-Za-z_$][\w$]*)/)?.[1] ?? []);
}

function classRuleForPath(path: string): ClassFileRule | undefined {
	const segments = path.split('/');
	if (segments.length !== 3 || segments[0] !== 'src') return undefined;
	return classFileRules.find((rule) => rule.folder === segments[1]);
}

function isPascalWithSuffix(value: string, suffix: string): boolean {
	return isPascalCase(value) && value.endsWith(suffix) && value.length > suffix.length;
}
