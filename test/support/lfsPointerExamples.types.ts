import type { LfsObject } from '../../src/utils/verification-evidence/lfsPointer.types';

/** An authored JSON marker; `$fixture` names the non-JSON value its call rebuilds. */
export interface LfsFixtureMarker {
	$fixture: string;
	file?: LfsObject;
	description?: string;
}
