import type { Targets } from './function.unit-measurements.test.types';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import type { SourceFile } from '../../src/core/development-tooling/sourceTypes';

export const revision = '0123456789abcdef0123456789abcdef01234567';

export const moduleOnly = [{ kind: 'module', entry: 'src/index.ts' }] as Targets;

export const noArtifact = 'A module unit emits no separate artifact.';

export const unread = 'Not measured: src/data.bin was not read.';

export const zod = { via: 'import', typeOnly: false, external: 'zod' } as const;

export const open = {
	via: 'import',
	typeOnly: false,
	uncertain: { reason: 'unresolved-import', detail: './gone' }
} as const;

const plain = { bytes: 100, lines: 10, language: 'ts', read: true, decisions: 'counted' } as const;

/** A unit manifest as the measurement reads it: owned source, dependencies and runtime targets. */
export function unit(id: string, source: string[], targets: Targets, dependencies: string[] = []) {
	const deps = dependencies.map((target) => ({ unit: target, via: 'import', origin: 'derived' }));
	const manifest = { id, owns: { source, symbols: [] }, dependencies: deps, runtime: { targets } };
	return manifest as unknown as ComponentManifest;
}

/** A source file as the index reports it; the facts a case does not name are the ordinary ones. */
export function file(path: string, patch: Partial<SourceFile> = {}): SourceFile {
	return { path, references: [], blocks: [], ...plain, ...patch } as SourceFile;
}

export const unitId = 'function.unit-measurements';

export const indexed = (files: SourceFile[]) =>
	new Map(files.map((item): [string, SourceFile] => [item.path, item]));
