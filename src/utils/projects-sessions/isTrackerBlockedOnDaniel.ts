// @harness-uid u_p4u7mgjvfn
/** Mentions of Daniel that record a past decision or say nothing is needed. */
const SETTLED =
	/\bno Daniel\b[^.;]*|\bno action\b[^.;]*\bDaniel\b[^.;]*|\bper Daniel\b(?:\/\w+)?|\bDaniel-approved\b|\bDaniel['’]s\b[^.;]{0,30}\bapproval stands\b|\bapproved by Daniel\b/gi;
const LATER_STEP = /\b(?:then|resume)\b[^.;]*\bask(?:ing)? (?:for )?Daniel\b[^.;]*/gi;
const WAITS_ON_DANIEL = [
	/\b(?:wait(?:s|ing)?|await(?:s|ing)?|need(?:s|ed)?|requires?|pending|blocked)\b[^.;]{0,120}\bDaniel\b/i,
	/\bDaniel to \w+|\bDaniel (?:must|needs to|has to)\b/i,
	/\bsudo requires a password\b|\bSystem Settings\b|\b(?:needs?|requires?) (?:a )?dashboard (?:setup|sign-?in)\b/i
];

/** @pure True when an unflagged blocked reason says the next action is one only Daniel can take. */
export function isTrackerBlockedOnDaniel(reason: string | null | undefined): boolean {
	const open = (reason ?? '').replace(LATER_STEP, '').replace(SETTLED, '');
	return WAITS_ON_DANIEL.some((pattern) => pattern.test(open));
}

/** @pure Private notes written by the legacy blocker or Chief of Staff routes. */
export function isPrivateTrackerReviewNote(note: string | null | undefined): boolean {
	return (
		!!note &&
		((/^blocked: /i.test(note) && isTrackerBlockedOnDaniel(note.slice(9))) ||
			/^for Chief of Staff: /i.test(note))
	);
}
