// @harness-uid u_vjf6edhc5l
import type { readOperations, writeOperations } from './vaultGatewayPolicy';

export type VaultReadOperation = (typeof readOperations)[number];
export type VaultWriteOperation = (typeof writeOperations)[number];
export type VaultOperationName = VaultReadOperation | VaultWriteOperation;

/** What one lease allows, taken from the approved recipe action. */
export interface VaultGatewayScope {
	origins: string[];
	redirects: string[];
	mode: 'read' | 'write';
	paths: string[];
	deny: string[];
	downloads: string[];
}

export interface VaultOperation {
	name: string;
	url?: string;
	fileType?: string;
}

export type VaultDecision = { allowed: true } | { allowed: false; reason: string };
