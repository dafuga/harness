import { createHash } from 'node:crypto';
import type { EvidenceTreeAdapter } from '../../../adapters/verification-evidence/EvidenceTreeAdapter';
import { ComponentManifestValidator } from '../../../validators/development-tooling/ComponentManifestValidator';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import { unitsDirectory } from '../../../core/development-tooling/unitsConfig';
import { fail } from '../../../core/development-tooling/errors';
import { canonicalJson } from '../../development-tooling/canonicalJson';
import { authoredUnitData } from './authoredUnitData';
import type { FrozenRegressionInputs } from '../regressionFiles.types';

export const unitManifestPath = (path: string) =>
	path.startsWith(`${unitsDirectory}/`) && path.endsWith('.json');

/** Read raw Git blobs in one batch; observed runner results never author these digests. */
export async function authoredInputs(
	tree: EvidenceTreeAdapter,
	commit: string,
	files: Map<string, string>
): Promise<FrozenRegressionInputs['expectations']> {
	const paths = [...files.keys()].filter(unitManifestPath).sort();
	const bytes = await tree.readMany(commit, paths);
	const expectations: FrozenRegressionInputs['expectations'] = [];
	for (const path of paths) {
		const unit = readAuthoredUnit(bytes.get(path), path);
		const data = authoredUnitData(unit);
		if (data === undefined) continue;
		expectations.push({
			unit: unit.id,
			path,
			blob: files.get(path)!,
			sha256: createHash('sha256').update(canonicalJson(data)).digest('hex')
		});
	}
	return expectations;
}

/** Validation checks the document; the returned raw data retains exact authored semantics. */
export function readAuthoredUnit(bytes: Buffer | undefined, path: string): ComponentManifest {
	const raw: unknown = JSON.parse(bytes?.toString('utf8') ?? 'null');
	if (!new ComponentManifestValidator().validate(raw, path).value)
		fail(`Cannot freeze invalid unit manifest: ${path}`);
	return raw as ComponentManifest;
}
