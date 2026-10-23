import type { Stored } from '../support/evidenceRecords';
import type { EvidenceFixture } from '../support/evidenceFixture';

export type Held = { stored: Stored; pointer: EvidenceFixture['pointers']['first'] };
