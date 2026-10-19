import type { Git } from './planGit';
import { blob, paths } from './planGit';
import { parse, fail } from './planData';
import { filename } from './planValidate';
import type { PlanCategory, PlanSummary } from '../models/Planning.types';

export function identity(unitId: string): void {
	filename(unitId);
	if (unitId.length > 200 || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(unitId))
		fail('invalid-input', 'Invalid unit identity');
}

export async function attest(
	git: Git,
	rev: string,
	unit: { unitId: string; category: PlanCategory }
): Promise<void> {
	identity(unit.unitId);
	const manifest = parse<{ id: string; kind: string }>(
		await blob(git, rev, `specification/units/${unit.unitId}.json`)
	);
	if (manifest.id !== unit.unitId || manifest.kind !== unit.category)
		fail('invalid-input', 'Canonical identity or category mismatch');
}

export async function planFiles(git: Git, rev: string): Promise<string[]> {
	return (await paths(git, rev, 'src')).filter((path) =>
		/^src\/(pages|shells|components|functions|configs|services)\/[^/]+\/plan.json$/.test(path)
	);
}

export async function findIdentity(git: Git, rev: string, unitId: string): Promise<string | null> {
	identity(unitId);
	const matches: string[] = [];
	for (const path of await planFiles(git, rev)) {
		try {
			const plan = parse<PlanSummary>(await blob(git, rev, path));
			if (plan.unitId === unitId) matches.push(path.slice(0, -10));
		} catch {
			/* Corrupt other entities are reported by snapshot, never borrowed. */
		}
	}
	if (matches.length > 1) fail('artifact-tampered', 'Duplicate planning identity');
	return matches[0] ?? null;
}

export async function planIdentity(git: Git, rev: string, unitId: string): Promise<string> {
	return (await findIdentity(git, rev, unitId)) ?? fail('not-found', 'Plan not found');
}

export { validateIdentity } from './plan-read/validateIdentity';
