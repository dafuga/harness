import { fail } from '../../../core/development-tooling/errors';
import type { VerificationNote } from '../history-status-service/HistoryStatusService.types';
import { HistoryStatusService } from '../history-status-service/HistoryStatusService';
import { HistoryNoteRepository } from '../../../repositories/git-source-history/history-note-repository/HistoryNoteRepository';
import { screenshotContract } from './screenshotContract';
import { selectScreenshot } from './selectScreenshot';
import type { ScreenshotCandidate, ScreenshotReviewInput } from './ScreenshotBaselineService.types';

/** Resolve the sealed source record and the original bytes before a person reviews the image. */
export async function screenshotCandidate(
	root: string,
	input: ScreenshotReviewInput
): Promise<ScreenshotCandidate> {
	const note = await new HistoryNoteRepository(root).read(input.commit);
	if (note.problems.length) return fail('The source commit has malformed history notes.');
	const matching = note.entries.filter(
		(entry): entry is VerificationNote =>
			entry.kind === 'verification' && entry.record === input.record
	);
	if (matching.length !== 1) return fail('The source verification is missing or ambiguous.');
	const status = new HistoryStatusService(root);
	const problems = await status.problems(matching[0]);
	if (problems.length) return fail(`The source verification is not intact: ${problems.join('; ')}`);
	const loaded = await status.attached.load(matching[0].evidence);
	const record = loaded.record;
	if (record?.source.commit !== input.commit)
		return fail('The source verification belongs to another revision.');
	if (record.gates?.snapshot !== 'passed' || record.gates?.registry !== 'passed')
		return fail('The source snapshot and registry must both have passed.');
	const contract = await screenshotContract(root, input);
	return selectScreenshot(input, contract, record, loaded.files);
}
