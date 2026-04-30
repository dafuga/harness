import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { collectAuditedFiles } from './collect';
import { maskTemplateLiterals, splitLines } from './commonRules';
import {
	adapterForExtension,
	adaptersForProfile,
	knownAuditExtensions,
	resolveAuditProfile
} from './adapters/registry';
import type { AuditAdapter, AuditFile, AuditOptions, AuditResult } from './adapters/types';
import type { AuditFinding } from './types';

export type { AuditFinding } from './types';
export type { AuditOptions, AuditResult } from './adapters/types';

export async function auditPath(root: string, options: AuditOptions = {}): Promise<AuditFinding[]> {
	return (await auditProject(root, options)).findings;
}

export async function auditProject(root: string, options: AuditOptions = {}): Promise<AuditResult> {
	const profile = resolveAuditProfile(root, options.profile);
	const collected = await collectAuditedFiles(root);
	const activeAdapters = adaptersForProfile(profile);
	const files = collected.files.map((file) => ({
		...file,
		relativePath: relative(root, file.path)
	}));
	const findings = await Promise.all(
		files.map((file) => auditCollectedFile(root, file.path, file.extension, profile))
	);

	return {
		findings: findings.flat(),
		coverage: {
			profile,
			adapters: activeAdapters.map((adapter) => adapterCoverage(adapter, files)),
			coveredFiles: files
				.filter((file) => adapterForExtension(file.extension, profile))
				.map((file) => file.relativePath),
			ignoredPaths: collected.ignoredPaths,
			unknownFiles: unknownFiles(files, profile)
		}
	};
}

async function auditCollectedFile(
	root: string,
	path: string,
	extension: string,
	profile: AuditResult['coverage']['profile']
): Promise<AuditFinding[]> {
	const adapter = adapterForExtension(extension, profile);
	if (!adapter) return [];
	const contents = (await readFile(path)).toString('utf8');
	return adapter.audit(auditFile(root, path, extension, contents));
}

function auditFile(root: string, path: string, extension: string, contents: string): AuditFile {
	return {
		absolutePath: path,
		relativePath: relative(root, path),
		extension,
		contents,
		lines: splitLines(contents),
		structuralLines: splitLines(maskTemplateLiterals(contents)),
		size: Buffer.byteLength(contents)
	};
}

function adapterCoverage(
	adapter: AuditAdapter,
	files: Array<{ extension: string; relativePath: string }>
) {
	return {
		id: adapter.id,
		label: adapter.label,
		extensions: adapter.extensions,
		optionalTools: adapter.optionalTools,
		files: files
			.filter((file) => adapter.extensions.includes(file.extension))
			.map((file) => file.relativePath)
	};
}

function unknownFiles(
	files: Array<{ extension: string; relativePath: string }>,
	profile: AuditResult['coverage']['profile']
): string[] {
	const knownExtensions = new Set(knownAuditExtensions());
	return files
		.filter(
			(file) => knownExtensions.has(file.extension) && !adapterForExtension(file.extension, profile)
		)
		.map((file) => file.relativePath);
}
