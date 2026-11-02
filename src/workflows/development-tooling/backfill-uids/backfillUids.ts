// @harness-uid u_ycgebzbwzx
import type { BackfillOptions, BackfillReport } from './backfillUids.types';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import { loadUnits } from '../load-units/loadUnits';
import { uidComment, withUid } from '../../../utils/development-tooling/unitUid';
import { mintUid } from './mintUid';

/**
 * Gives every active unit a stable uid, written in its registry file and in each of its source
 * files that takes a comment. Ids, contracts and history are never touched; running it again
 * changes nothing.
 */
export async function backfillUids(options: BackfillOptions = {}): Promise<BackfillReport> {
	const loaded = await loadUnits(options.root);
	const taken = new Set([
		...loaded.stored.flatMap((unit) => (unit.uid ? [unit.uid] : [])),
		...[...loaded.index.files.values()].flatMap((file) => (file.uid ? [file.uid] : []))
	]);
	const report: BackfillReport = {
		units: 0,
		assigned: [],
		annotated: [],
		registryOnly: [],
		conflicts: [],
		written: 0
	};
	const active = loaded.stored.filter((unit) => unit.status === 'active');
	for (const unit of active.sort((left, right) => (left.id < right.id ? -1 : 1))) {
		report.units += 1;
		const files = unit.owns.source.flatMap((path) => loaded.index.files.get(path) ?? []);
		const announced = [...new Set(files.flatMap((file) => (file.uid ? [file.uid] : [])))];
		const conflict = disagreement(unit, announced);
		if (conflict) {
			report.conflicts.push({ id: unit.id, reason: conflict });
			continue;
		}
		const uid = unit.uid ?? announced[0] ?? mintUid(taken);
		const missing = files.filter((file) => !file.uid && uidComment(file.path, uid));
		if (!files.some((file) => uidComment(file.path, uid))) report.registryOnly.push(unit.id);
		if (!unit.uid) report.assigned.push({ id: unit.id, uid });
		report.annotated.push(...missing.map((file) => file.path));
		if (options.write)
			report.written += await apply(
				loaded,
				unit,
				uid,
				missing.map((f) => f.path)
			);
	}
	return report;
}

function disagreement(unit: ComponentManifest, announced: string[]): string | undefined {
	if (announced.length > 1) return `its files announce ${announced.length} different uids`;
	if (unit.uid && announced[0] && announced[0] !== unit.uid)
		return `its files announce ${announced[0]} but the registry holds ${unit.uid}`;
	return undefined;
}

async function apply(
	loaded: Awaited<ReturnType<typeof loadUnits>>,
	unit: ComponentManifest,
	uid: string,
	paths: string[]
): Promise<number> {
	let written = 0;
	for (const path of paths) {
		const file = join(loaded.root, path);
		const code = await readFile(file, 'utf8');
		await writeFile(file, withUid(path, code, uid));
		written += 1;
	}
	if (!unit.uid) {
		const { schemaVersion, id, ...rest } = unit;
		const stamped = { schemaVersion, id, uid, ...rest } as ComponentManifest;
		written += (await loaded.repository.write([stamped])).length;
	}
	return written;
}
