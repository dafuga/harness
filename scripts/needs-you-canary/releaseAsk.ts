// @harness-uid u_33ar5mqlcl
import { signedOut } from './checkSurface';
import { surfaceNames } from './canaryAsk';
import type { CanaryResult } from './canary.types';

export const canaryPrefix = 'needs-you canary:';
export const questionPrefix = 'Release canary:';

const tapAll =
	"I'll tap the test asks=A session reruns the canary with --tap web,mac,iphone while you are free. You answer each test ask with the option it names, in your own browser, the Mac app and the iPhone. No automation sign-in needed.";
const signInOnce =
	'Sign automation Chrome in to Hub once=You sign in by hand on the primary Mac; the script then answers Hub web. Every local agent could then use your Hub, incl. linked Macs, and Google stays signed in until you sign out. Google may refuse (untested). Mac and iPhone still need your tap.';
const keepBlocked =
	'Keep the release blocked=Nothing is accepted. The cause is fixed first, then the canary runs again.';

export function surfaceSummary(results: CanaryResult[]): string {
	return results
		.map((result) => `${surfaceNames[result.surface]}: ${result.state} (${result.detail})`)
		.join('; ');
}

/** The flag words for a release that did not pass: what is unproven, and the ways forward. */
export function releaseAskArgs(release: string, results: CanaryResult[]): string[] {
	const open = results.filter((result) => result.state !== 'passed');
	const broken = open.some((result) => result.state === 'failed');
	const options = [tapAll, keepBlocked];
	if (open.some((result) => result.detail === signedOut)) options.splice(1, 0, signInOnce);
	const recommend = broken ? options.indexOf(keepBlocked) + 1 : 1;
	const question = `${questionPrefix} needs-you is not proven on production for this release. ${surfaceSummary(open)}. How should it be checked?`;
	return [
		'flag',
		release,
		question,
		...options.flatMap((option) => ['--option', option]),
		'--recommend',
		String(recommend),
		'--force'
	];
}
