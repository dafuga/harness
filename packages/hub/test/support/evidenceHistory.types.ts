import type { HistoryNote } from '../../../../src/core/historyTypes';
import type { FakeGit } from './evidenceGit';
import type { evidenceHistory } from './evidenceHistory';

export type Files = Map<string, Uint8Array>;

export type Notes = Map<string, HistoryNote[]>;

export interface Source {
	git: FakeGit;
	root: string;
	changed: string;
}

export type EvidenceHistory = ReturnType<typeof evidenceHistory>;
