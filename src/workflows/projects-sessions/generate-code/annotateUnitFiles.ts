// @harness-uid u_yaf6sntjte
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PlannedFile } from '../../../core/development-tooling/files';
import { mintUid } from '../../development-tooling/backfill-uids/mintUid';
import { readUid, withUid } from '../../../utils/development-tooling/unitUid';

const notUnit = /(?:^|\/)(?:tests?|db)\/|\.(?:test|spec)\.|\.types\.ts$|^src\/models\/adapters\//;

/**
 * Gives each generated source file the uid of its own new unit, so a later move or rename keeps
 * the unit. A file already on disk keeps the uid it has, so generating twice stays identical.
 * Tests, type companions and files that take no comment are returned as they are.
 */
export function annotateUnitFiles(files: PlannedFile[], root: string): PlannedFile[] {
	const taken = new Set<string>();
	return files.map((file) => {
		if (notUnit.test(file.path)) return file;
		const target = join(root, file.path);
		const existing = existsSync(target) ? readUid(readFileSync(target, 'utf8')) : undefined;
		return { ...file, contents: withUid(file.path, file.contents, existing ?? mintUid(taken)) };
	});
}
