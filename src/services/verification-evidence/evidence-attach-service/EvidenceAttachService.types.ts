import type { EvidencePointer } from '../../../core/git-source-history/historyTypes';

export interface Attached {
	record: string;
	status: 'passed' | 'failed';
	source: string;
	evidence: EvidencePointer;
	note: string;
	archive: string;
	/** False when this exact record was already attached. */
	created: boolean;
}
