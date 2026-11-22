// @harness-uid u_wwerrde2nk
import { fail } from '../../../core/development-tooling/errors';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { loopPaths } from '../loop-state/loopState';
import type { BugSweepReport } from '../../../utils/development-tooling/siblingBugSweep.types';
import { recordBugClass } from '../../../utils/development-tooling/sibling-bug-sweep/recordBugClass';
import type { SiblingRepairResult } from './repairSibling.types';

export async function beginSiblingReport(
	root: string,
	loop: string,
	runId: string,
	output: BugSweepReport & { repairs?: SiblingRepairResult[] }
) {
	const classPath = await recordBugClass(root, output.bugClass, output.revision);
	const filename = `siblings-${runId}.json`;
	const { dir } = loopPaths(root, loop);
	await mkdir(dir, { recursive: true });
	const path = join(dir, filename);
	const persist = async (repairs?: SiblingRepairResult[]) => {
		const draft = { ...output, classPath, ...(repairs ? { repairs } : {}) };
		const pending = path + '.tmp';
		await writeFile(pending, JSON.stringify(draft, null, '\t') + '\n');
		await rename(pending, path);
	};
	await persist();
	return { filename, persist };
}

export async function requireSiblingReport(root: string, loop: string, filename: string) {
	if (!/^siblings-[a-f0-9-]{36}\.json$/.test(filename))
		fail('Use harness loop siblings to record a sibling report before completing this step.');
	const report = JSON.parse(
		await readFile(join(loopPaths(root, loop).dir, filename), 'utf8')
	) as BugSweepReport & {
		repairs?: SiblingRepairResult[];
	};
	const revision = await new GitAdapter(root).run(['rev-parse', 'HEAD']);
	if (report.schemaVersion !== 1 || report.revision !== revision)
		fail('The sibling report must cover the current commit.');
	if (!siblingReportComplete(report))
		fail('The sibling report has incomplete evaluation or repair.');
}

export function siblingReportComplete(
	report: BugSweepReport & { repairs?: SiblingRepairResult[] }
) {
	return (
		report.errors.length === 0 &&
		report.skipped.length === 0 &&
		(report.repairs === undefined ||
			report.candidates
				.filter((site) => site.verdict === 'confirmed')
				.every((site) =>
					report.repairs?.some((repair) => repair.id === site.id && repair.outcome === 'accepted')
				))
	);
}
