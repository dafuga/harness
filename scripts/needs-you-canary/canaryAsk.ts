// @harness-uid u_d6gdogyd6m
import type { CanaryAsk, CanarySurface } from './canary.types';

export const surfaceNames: Record<CanarySurface, string> = {
	web: 'Hub web',
	mac: 'the Mac app',
	iphone: 'the iPhone'
};

/**
 * What each app's own answer write records as `answered_by`: Hub web through the linked Mac, the Mac
 * app's Needs you page (which names no one, as the CLI does too) and the iPhone's intent.
 */
export const surfaceAnswerers: Record<CanarySurface, string> = {
	web: 'Daniel via Hub',
	mac: 'daniel',
	iphone: 'Daniel'
};

const labels = ['Canary A', 'Canary B', 'Canary C'];
const effect = 'Test answer only. Nothing deploys or changes.';

/** One surface's test ask. The option to answer with is random, so a default cannot pass. */
export function canaryAsk(input: {
	surface: CanarySurface;
	release: string;
	nonce: string;
	expected: number;
	byHand: boolean;
}): CanaryAsk {
	const { surface, release, nonce, expected, byHand } = input;
	const marker = `[canary-${nonce}-${surface}]`;
	const who = byHand ? 'Please' : 'No action needed, the release script will';
	const instruction = `answer "${labels[expected - 1]}" on ${surfaceNames[surface]}`;
	return {
		surface,
		marker,
		title: `RELEASE CANARY (TEST ONLY) ${surface} for ${release.slice(0, 6)} ${nonce}`,
		question: `TEST ONLY, release canary ${marker}. ${who} ${instruction}. Nothing deploys or changes.`,
		labels,
		expected
	};
}

export function addArgs(ask: CanaryAsk): string[] {
	// --later: a test item must never start a session. --force: canaries resemble each other.
	return ['add', ask.title, '--agent', 'harness', '--later', '--force'];
}

export function flagArgs(id: string, ask: CanaryAsk): string[] {
	const options = ask.labels.flatMap((label) => ['--option', `${label}=${effect}`]);
	// The recommended option is never the one to answer with.
	const recommend = String((ask.expected % ask.labels.length) + 1);
	return ['flag', id, ask.question, ...options, '--recommend', recommend, '--force'];
}
