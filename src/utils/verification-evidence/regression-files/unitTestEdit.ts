import type { EvidenceTreeAdapter } from '../../../adapters/verification-evidence/EvidenceTreeAdapter';
import { canonicalJson } from '../../development-tooling/canonicalJson';
import { authoredUnitData, productUnitData } from './authoredUnitData';
import { readAuthoredUnit } from './authoredInputs';
import type { UnitTestEdit } from '../regressionFiles.types';

/** Explicitly naming a manifest cannot turn a product change into a test-only edit. */
export async function unitTestEdit(
	tree: EvidenceTreeAdapter,
	commit: string,
	path: string,
	tests: string[]
): Promise<UnitTestEdit> {
	const beforeBytes = await tree.read(`${commit}^`, path);
	const afterBytes = await tree.read(commit, path);
	if (!beforeBytes || !afterBytes) return { allowed: false, strengthened: false };
	const before = readAuthoredUnit(beforeBytes, path),
		after = readAuthoredUnit(afterBytes, path);
	const allowed = canonicalJson(productUnitData(before)) === canonicalJson(productUnitData(after));
	const changed =
		canonicalJson(authoredUnitData(before)) !== canonicalJson(authoredUnitData(after));
	const cases = [...(before.testing?.cases ?? []), ...(after.testing?.cases ?? [])];
	const named = tests.includes(path) || cases.some((item) => tests.includes(item.test.file));
	return { allowed, strengthened: allowed && changed && named };
}
