import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import type { AuditAdapter, AuditFile } from './types';

const artifactDirs = ['/artifacts/', '/smart-contract/', '/contracts/', '/wasm/'];

export const wasmAdapter: AuditAdapter = {
	id: 'wasm',
	label: 'WASM artifacts',
	profiles: ['lib'],
	extensions: ['.abi', '.wasm'],
	optionalTools: [],
	audit(file) {
		return [...auditArtifactPlacement(file), ...auditArtifactPairing(file), ...auditAbiJson(file)];
	}
};

function auditArtifactPlacement(file: AuditFile) {
	const path = `/${file.relativePath}`;
	if (artifactDirs.some((part) => path.includes(part))) return [];
	return [{ path: file.relativePath, rule: 'wasm-artifact-placement', message: 'WASM and ABI artifacts should live under an artifact or contract directory.' }];
}

function auditArtifactPairing(file: AuditFile) {
	if (file.extension !== '.wasm') return [];
	const parsed = parse(file.absolutePath);
	if (['.abi', '.cpp', '.c', '.ts'].some((ext) => existsSync(join(dirname(file.absolutePath), `${parsed.name}${ext}`)))) return [];

	return [{ path: file.relativePath, rule: 'wasm-source-pairing', message: 'WASM artifacts should be paired with source or ABI metadata.' }];
}

function auditAbiJson(file: AuditFile) {
	if (file.extension !== '.abi') return [];
	try {
		JSON.parse(file.contents);
		return [];
	} catch {
		return [{ path: file.relativePath, rule: 'wasm-abi-json', message: 'ABI artifacts should be valid JSON.' }];
	}
}
