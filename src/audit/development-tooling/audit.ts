import { ModuleCatalogService } from '../../services/module-system/ModuleCatalogService';
import type { ModuleCatalog } from '../../services/module-system/moduleDefinition.types';
import { moduleOutputPath } from '../../services/module-system/moduleWrites';
import type { AuditCollectedFileInput, AuditFileInput } from './audit.types';
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { collectAuditedFiles } from './collect';
import { maskTemplateLiterals, splitLines } from './commonRules';
import { filterIgnoredFindings, readAuditConfig } from './config';
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
import { resolveCleanCodeSettings } from './cleanCodeConfig';
import { reviewCleanCode } from './reviewCleanCode';

export type { AuditFinding } from './types';
export type { AuditOptions, AuditResult } from './adapters/types';

export async function auditPath(root: string, options: AuditOptions = {}): Promise<AuditFinding[]> {
	return (await auditProject(root, options)).findings;
}

export async function auditProject(root: string, options: AuditOptions = {}): Promise<AuditResult> {
	const result = await auditStaticProject(root, options);
	const settings = resolveCleanCodeSettings(readAuditConfig(root).cleanCode, options.cleanCode);
	if (settings.mode !== 'off') {
		result.cleanCode = await reviewCleanCode({
			root,
			settings,
			options: options.cleanCode,
			findings: result.findings
		});
	}
	return result;
}

async function auditStaticProject(root: string, options: AuditOptions): Promise<AuditResult> {
	const profile = resolveAuditProfile(root, options.profile);
	const config = readAuditConfig(root);
	const collected = await collectAuditedFiles(root);
	const activeAdapters = adaptersForProfile(profile);
	const files = collected.files.map((file) => ({
		...file,
		relativePath: relative(root, file.path)
	}));
	const findings = await Promise.all(
		files.map((file) =>
			auditCollectedFile({
				root,
				path: file.path,
				extension: file.extension,
				profile,
				limits: config.limits
			})
		)
	);
	const catalog = await new ModuleCatalogService().load(root);
	const structureFindings = auditProjectStructure(activeAdapters, {
		moduleSourceFolders: declaredSourceFolders(catalog),
		root,
		profile,
		files: files.map((file) => file.relativePath),
		dirs: collected.dirs
	});

	const filteredFindings = filterIgnoredFindings(
		[
			...catalog.gaps.map((message) => ({
				path: 'harness.modules.json',
				rule: 'harness-source-structure',
				message
			})),
			...structureFindings,
			...findings.flat()
		],
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

async function auditCollectedFile(input: AuditCollectedFileInput): Promise<AuditFinding[]> {
	const adapter = adapterForExtension(input.extension, input.profile);
	if (!adapter) return [];
	const contents = (await readFile(input.path)).toString('utf8');
	return adapter.audit(auditFile({ ...input, contents }));
}

function auditFile(input: AuditFileInput): AuditFile {
	return {
		absolutePath: input.path,
		relativePath: relative(input.root, input.path),
		extension: input.extension,
		contents: input.contents,
		lines: splitLines(input.contents),
		structuralLines: splitLines(maskTemplateLiterals(input.contents)),
		limits: input.limits,
		size: Buffer.byteLength(input.contents)
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

/** Only active, validated module output plans extend the source-folder boundary. */
function declaredSourceFolders(catalog: ModuleCatalog): string[] {
	const paths = catalog.modules
		.filter((entry) => entry.installed)
		.flatMap((entry) => [
			...entry.definition.setup,
			...entry.definition.resources.flatMap((resource) => resource.files)
		]);
	return paths.flatMap((file) => {
		try {
			const path = moduleOutputPath(file.path.replace(/\{\{[A-Za-z]+\}\}/g, 'ModuleName'));
			const folder = /^src\/([a-z][a-z0-9-]*)\//.exec(path)?.[1];
			return folder ? [folder] : [];
		} catch {
			return [];
		}
	});
}
