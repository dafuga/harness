import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cppAdapter } from './cpp';
import { pythonAdapter } from './python';
import { shellAdapter } from './shell';
import { sqlAdapter } from './sql';
import { svelteAdapter } from './svelte';
import { typeScriptAdapter } from './typescript';
import type { AuditAdapter, AuditProfile } from './types';
import { wasmAdapter } from './wasm';

export const auditAdapters = [
	typeScriptAdapter,
	svelteAdapter,
	sqlAdapter,
	cppAdapter,
	pythonAdapter,
	shellAdapter,
	wasmAdapter
] as const satisfies AuditAdapter[];

export function adaptersForProfile(profile: Exclude<AuditProfile, 'auto'>): AuditAdapter[] {
	return auditAdapters.filter((adapter) => adapter.profiles.includes(profile));
}

export function adapterForExtension(
	extension: string,
	profile: Exclude<AuditProfile, 'auto'>
): AuditAdapter | undefined {
	return adaptersForProfile(profile).find((adapter) => adapter.extensions.includes(extension));
}

export function knownAuditExtensions(): string[] {
	return [...new Set([...auditAdapters.flatMap((adapter) => adapter.extensions), ...knownFutureExtensions])];
}

const knownFutureExtensions = ['.go', '.java', '.kt', '.m', '.mm', '.rs', '.swift', '.vue'];

export function resolveAuditProfile(root: string, profile: AuditProfile = 'auto'): Exclude<AuditProfile, 'auto'> {
	if (profile !== 'auto') return profile;
	const packageKind = framePackageKind(root);
	if (packageKind === 'app' || packageKind === 'lib') return packageKind;
	return existsSync(join(root, 'svelte.config.js')) || existsSync(join(root, 'src/routes')) ? 'app' : 'lib';
}

function framePackageKind(root: string): string | undefined {
	try {
		const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { frame?: { kind?: string } };
		return pkg.frame?.kind;
	} catch {
		return undefined;
	}
}
