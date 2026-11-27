// @harness-uid u_jy4ju42swm
import { canaryPrefix, questionPrefix, releaseAskArgs, surfaceSummary } from './releaseAsk';
import type { CanaryItem, CanaryOptions, CanaryReport } from './canary.types';

/** Note the result on the release item; hold it unless every surface passed. */
export async function recordRelease(options: CanaryOptions, report: CanaryReport): Promise<void> {
	const { release, tracker } = options;
	const verdict = report.passed ? 'PASSED' : 'NOT PASSED';
	const ids = report.results.flatMap((result) => (result.itemId ? [result.itemId] : []));
	const items = ids.length ? ` Test items: ${ids.join(', ')}.` : ' No test item was raised.';
	const at = new Date(options.clock.now()).toISOString();
	await tracker([
		'note',
		release,
		`needs-you canary ${verdict} ${at}: ${surfaceSummary(report.results)}.${items}`
	]);
	const item = await tracker(['show', release]);
	if (report.passed) await releaseHold(options, item);
	else await holdRelease(options, item, report);
}

async function holdRelease(options: CanaryOptions, item: CanaryItem, report: CanaryReport) {
	const { release, tracker } = options;
	// Another open question on the release is Daniel's to answer first; never replace it.
	const otherAsk =
		item.needs_daniel && !item.answered_at && !item.question?.startsWith(questionPrefix);
	if (otherAsk)
		options.log('The release already has another open ask, so the canary did not replace it.');
	else await tracker(releaseAskArgs(release, report.results));
	if (item.status === 'blocked' && !item.blocked_reason?.startsWith(canaryPrefix)) return;
	const open = report.results.filter((result) => result.state !== 'passed');
	const surfaces = open.map((result) => `${result.surface} ${result.state}`).join(', ');
	await tracker(['block', release, `${canaryPrefix} ${surfaces}`, '--force']);
}

/** Remove only what an earlier canary run put on the release item. */
async function releaseHold(options: CanaryOptions, item: CanaryItem) {
	const { release, tracker } = options;
	if (item.needs_daniel && item.question?.startsWith(questionPrefix))
		await tracker(['unflag', release]);
	if (item.status === 'blocked' && item.blocked_reason?.startsWith(canaryPrefix))
		await tracker(['unblock', release, '--note', 'needs-you canary passed']);
}
