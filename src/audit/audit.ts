import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { collectAuditedFiles } from './collect';
import { maskTemplateLiterals, splitLines } from './commonRules';
import { filterIgnoredFindings, readAuditConfig } from './config';
import { auditDuplicatedCode } from './duplicateRules';
import {
	adapterForExtension,
	adaptersForProfile,
	knownAuditExtensions,
	resolveAuditProfile
} from './adapters/registry';
import type {
	AuditAdapter,
	AuditFile,
	AuditOptions,
	AuditResult,
	AuditStructure
} from './adapters/types';
import type { AuditFinding } from './types';

export type { AuditFinding } from './types';
export type { AuditOptions, AuditResult } from './adapters/types';

export async function auditPath(root: string, options: AuditOptions = {}): Promise<AuditFinding[]> {
	return (await auditProject(root, options)).findings;
}

export async function auditProject(root: string, options: AuditOptions = {}): Promise<AuditResult> {
	const profile = resolveAuditProfile(root, options.profile);
	const config = readAuditConfig(root);
	const collected = await collectAuditedFiles(root);
	const activeAdapters = adaptersForProfile(profile);
	const files = collected.files.map((file) => ({
		...file,
		relativePath: relative(root, file.path)
	}));
	const knownFiles = files.filter((file) => adapterForExtension(file.extension, profile));
	const auditFiles = await Promise.all(knownFiles.map((file) => readAuditFile(root, file)));
	const adapterFindings = auditFiles.flatMap((file) => auditFileWithAdapter(file, profile));
	const structureFindings = auditProjectStructure(activeAdapters, {
		profile,
		files: files.map((file) => file.relativePath),
		dirs: collected.dirs
	});
	const duplicateFindings = auditDuplicatedCode(auditFiles);

	const filteredFindings = filterIgnoredFindings(
		[...structureFindings, ...adapterFindings, ...duplicateFindings],
		config
	);

	return {
		findings: filteredFindings.activeFindings,
		coverage: {
			profile,
			adapters: activeAdapters.map((adapter) => adapterCoverage(adapter, files)),
			coveredFiles: files
				.filter((file) => adapterForExtension(file.extension, profile))
				.map((file) => file.relativePath),
			ignoredPaths: collected.ignoredPaths,
			ignoredFindings: filteredFindings.ignoredFindings,
			unknownFiles: unknownFiles(files, profile)
		}
	};
}

function auditProjectStructure(
	adapters: AuditAdapter[],
	structure: AuditStructure
): AuditFinding[] {
	return adapters.flatMap((adapter) => adapter.auditStructure?.(structure) ?? []);
}

async function readAuditFile(
	root: string,
	file: { path: string; extension: string }
): Promise<AuditFile> {
	const contents = (await readFile(file.path)).toString('utf8');
	return auditFile(root, file.path, file.extension, contents);
}

function auditFileWithAdapter(
	file: AuditFile,
	profile: AuditResult['coverage']['profile']
): AuditFinding[] {
	const adapter = adapterForExtension(file.extension, profile);
	return adapter?.audit(file) ?? [];
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
