import type { EvidencePointer } from '../../../../../../../src/core/historyTypes';
import type { EvidenceFile } from '../../../../../../../src/core/historyTypes';

export type Input = { pointer: EvidencePointer; file: EvidenceFile };

/** What one declared file turned out to be: its bytes and frozen fact only when intact. */
export interface Checked {
	bytes?: Uint8Array;
	problems: string[];
	fact?: Readonly<EvidenceFile & { blob: string }>;
}
