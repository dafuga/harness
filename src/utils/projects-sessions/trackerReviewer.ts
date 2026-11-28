// @harness-uid u_c5mwmd6z6z
import { isTrackerCosMessage } from './isTrackerPing';

const plumbingActor = /^tracker(?:-health| backups)$/i;
const plumbingQuestion =
	/^(?:\d+ Tracker alerts? (?:has|have) not reached your Chief of Staff session\b|Tracker health on .+ is failing:|Tracker backup failed:|(?:Blocked: )?auto-launch\b|Tracker recovery:)/i;
const plumbingTitles = new Set([
	'Tracker alerts are not reaching Chief of Staff',
	'Tracker backups need attention'
]);

/** @pure Who may publish an ask without review. */
export function trackerReviewer(actor: string | null | undefined): 'chief' | 'daniel' | null {
	const name = actor?.split('@')[0]?.trim() ?? '';
	if (/^(?:cos|chief[-_ ]of[-_ ]staff)$/i.test(name)) return 'chief';
	if (/^(?:daniel(?: fugere)?|danielfugere)$/i.test(name)) return 'daniel';
	return null;
}

/** @pure True for asks about the Tracker's own plumbing, which only Chief of Staff handles. */
export function isTrackerPlumbingAsk(
	actor: string | null | undefined,
	text: string,
	title: string
): boolean {
	return (
		plumbingActor.test(actor ?? '') ||
		plumbingQuestion.test(text) ||
		isTrackerCosMessage(text) ||
		plumbingTitles.has(title)
	);
}
