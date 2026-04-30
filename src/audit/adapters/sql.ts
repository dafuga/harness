import { auditFileLength } from '../commonRules';
import type { AuditAdapter, AuditFile } from './types';

export const sqlAdapter: AuditAdapter = {
	id: 'sql',
	label: 'SQL',
	profiles: ['app'],
	extensions: ['.sql'],
	optionalTools: ['sqlfluff'],
	audit(file) {
		return [
			...auditFileLength(file.relativePath, file.lines),
			...auditDangerousSql(file),
			...auditMigrationReversibility(file),
			...auditSeedPlacement(file)
		];
	}
};

function auditDangerousSql(file: AuditFile) {
	const contents = uncommentedSql(file).toLowerCase();
	if (!/(drop\s+table|truncate\s+table|delete\s+from\s+\w+\s*;)/.test(contents)) return [];

	return [
		{
			path: file.relativePath,
			rule: 'sql-dangerous-migration',
			message: 'Dangerous SQL changes need explicit rollback guidance and careful review.'
		}
	];
}

function auditMigrationReversibility(file: AuditFile) {
	if (
		!file.relativePath.includes('db/migrations/') ||
		/--\s*(rollback|reversible)/i.test(file.contents)
	)
		return [];
	if (!/\b(create|alter|drop)\b/i.test(file.contents)) return [];

	return [
		{
			path: file.relativePath,
			rule: 'sql-reversible-migration',
			message: 'Migrations should include a rollback or reversible comment.'
		}
	];
}

function auditSeedPlacement(file: AuditFile) {
	if (
		!file.relativePath.includes('db/migrations/') ||
		!/\binsert\s+into\b/i.test(uncommentedSql(file))
	)
		return [];
	return [
		{
			path: file.relativePath,
			rule: 'sql-seed-in-migration',
			message: 'Seed data belongs in seed files, not migrations.'
		}
	];
}

function uncommentedSql(file: AuditFile): string {
	return file.lines.map((line) => line.replace(/--.*$/, '')).join('\n');
}
