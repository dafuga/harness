// @harness-uid u_hsttypabcd
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { ContractOptions } from './contracts.types';

export interface StoredContract {
	id: string;
	uid?: string;
	kind: string;
	contractPath: string;
	sourcePaths: string[];
	raw: string;
	data: Record<string, unknown>;
}

export interface ContractHistoryOptions extends ContractOptions {
	unit?: string;
	field?: string;
	since?: string;
	staged?: boolean;
	summary?: boolean;
}

export interface ContractFieldChange {
	path: string;
	kind: 'added' | 'removed' | 'changed';
	before?: unknown;
	after?: unknown;
}

export interface ContractChange {
	id: string;
	previousId?: string;
	kind: 'added' | 'removed' | 'moved' | 'changed';
	contractPath: string;
	previousContractPath?: string;
	sourcePaths: string[];
	fields: ContractFieldChange[];
}

export interface ContractChangeSummary {
	contracts: number;
	added: number;
	removed: number;
	moved: number;
	changed: number;
	fields: number;
	formattingOnlyFiles: number;
	reorderedOnlyFiles: number;
}

export interface ContractDiff {
	base: string;
	head: string;
	summary: ContractChangeSummary;
	total: number;
	truncated: boolean;
	changes: ContractChange[];
}

export interface ContractCommitChange {
	commit: string;
	date: string;
	author: { name: string; email: string };
	subject: string;
	summary: ContractChangeSummary;
	changes: ContractChange[];
}

export interface ContractLog {
	head: string;
	since?: string;
	identityScope: string;
	scannedCommits: number;
	truncated: boolean;
	entries: ContractCommitChange[];
}

export interface ContractSnapshotContext {
	root: string;
	git: GitAdapter;
	blobs: Map<string, string>;
	parsed: Map<string, Record<string, unknown>>;
	snapshots: Map<string, StoredContract[]>;
}

export interface ContractHistoryReader {
	git: GitAdapter;
	read: (revision: string) => Promise<StoredContract[]>;
}

export interface ContractHistoryCommit {
	commit: string;
	parent: string;
	date: string;
	name: string;
	email: string;
	subject: string;
}

export interface ContractLogContext {
	reader: ContractHistoryReader;
	result: ContractLog;
	unit: string;
	identity: string;
	options: ContractHistoryOptions;
}
