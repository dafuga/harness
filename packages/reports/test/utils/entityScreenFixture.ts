import type { HarnessUnit } from '../../src/models/explorer-ui/Harness.types';
import type { Revision } from './entity-screens.test.types';
import { explorerEvidence } from '../../src/utils/explorerEvidence';
import { scope } from '../entityPlaces';

/** What the host gives for the page: the tip alone, or a commit beside the parent it names. */
export function evidence(page: HarnessUnit, shown: Revision, parent?: Revision | null) {
	if (parent === undefined)
		return explorerEvidence(scope('current'), { head: shown, parent: null }, page);
	const at = { ...scope('commit'), parent: parent ? parent.commit : null };
	return explorerEvidence(at, { head: shown, parent }, page);
}
