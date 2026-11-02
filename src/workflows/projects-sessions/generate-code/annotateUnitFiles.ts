// @harness-uid u_yaf6sntjte
import type { PlannedFile } from '../../../core/development-tooling/files';
import { mintUid } from '../../development-tooling/backfill-uids/mintUid';
import { withUid } from '../../../utils/development-tooling/unitUid';

const notUnit = /(?:^|\/)(?:tests?|db)\/|\.(?:test|spec)\.|\.types\.ts$/;

/**
 * Gives each generated source file the uid of its own new unit, so a later move or rename keeps
 * the unit. Tests, type companions and files that take no comment are returned as they are.
 */
export function annotateUnitFiles(files: PlannedFile[]): PlannedFile[] {
	const taken = new Set<string>();
	return files.map((file) =>
		notUnit.test(file.path)
			? file
			: { ...file, contents: withUid(file.path, file.contents, mintUid(taken)) }
	);
}
