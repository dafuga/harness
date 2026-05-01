import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { antelopeDappAdapter } from './antelopeDapp';
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
	antelopeDappAdapter,
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
	return [
		...new Set([
			...auditAdapters.flatMap((adapter) => adapter.extensions),
			...knownFutureExtensions
		])
	];
}

const knownFutureExtensions = ['.go', '.java', '.kt', '.m', '.mm', '.rs', '.swift', '.vue'];

export function resolveAuditProfile(
	root: string,
	profile: AuditProfile = 'auto'
): Exclude<AuditProfile, 'auto'> {
	if (profile !== 'auto') return profile;
	return detectAuditProfile(root);
}

function detectAuditProfile(root: string): Exclude<AuditProfile, 'auto'> {
	const packageKind = harnessPackageKind(root);
	const hasContracts = hasContractWorkspace(root);
	if (packageKind === 'lib') return 'lib';
	if (packageKind === 'dapp' || (packageKind === 'app' && hasContracts)) return 'dapp';
	if (packageKind === 'app') return 'app';
	return detectUnconfiguredProfile(root, hasContracts);
}

function detectUnconfiguredProfile(
	root: string,
	hasContracts: boolean
): Exclude<AuditProfile, 'auto'> {
	if (hasContracts) return 'dapp';
	return isSvelteApp(root) ? 'app' : 'lib';
}

function isSvelteApp(root: string): boolean {
	return existsSync(join(root, 'svelte.config.js')) || existsSync(join(root, 'src/routes'));
}

function hasContractWorkspace(root: string): boolean {
	return existsSync(join(root, 'smart-contract/contracts')) || existsSync(join(root, 'contracts'));
}

function harnessPackageKind(root: string): string | undefined {
	try {
		const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
			harness?: { kind?: string };
		};
		return pkg.harness?.kind;
	} catch {
		return undefined;
	}
}
