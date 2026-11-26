// @harness-uid u_r7qgepnoax
import type { NativeTrackerAskValues } from './nativeTrackerCli.types';
import { trackerAskOptionFromWord } from '../../../utils/projects-sessions/trackerAskOptions';
import { isTrackerCosMessage } from '../../../utils/projects-sessions/isTrackerPing';
import { isTrackerSpecReview } from '../../../utils/projects-sessions/isTrackerSpecReview';

/** The ask-choice words of one command line: `--option label=effect` (repeat), `--recommend N`. */
export function nativeTrackerAskBody(values: NativeTrackerAskValues): Record<string, unknown> {
	const confirm = values.confirm === undefined ? {} : { confirm: values.confirm };
	const words = values.option;
	if (words === undefined) {
		if (values.recommend !== undefined) throw new TypeError('--recommend needs --option');
		return confirm;
	}
	if (!Array.isArray(words) || words.length < 2 || words.length > 4)
		throw new TypeError('give 2 to 4 --option "label=what happens" words');
	const recommend = recommendedNumber(values.recommend, words.length);
	const options = words.map((word, index) => ({
		...trackerAskOptionFromWord(String(word)),
		...(recommend === index + 1 ? { recommended: true } : {})
	}));
	return { options, ...confirm };
}

/** The recommendation is the option's 1-based number or its letter (A is the first). */
function recommendedNumber(value: unknown, count: number): number | undefined {
	if (value === undefined) return undefined;
	const word = String(value).trim().toUpperCase();
	const number = /^[A-D]$/.test(word) ? word.charCodeAt(0) - 64 : Number(word);
	if (!Number.isInteger(number) || number < 1 || number > count)
		throw new TypeError(`--recommend must be 1 to ${count} (or its letter)`);
	return number;
}

/** The body of `tracker flag`: the question plus any choices. */
export function nativeTrackerFlagBody(
	text: string,
	values: NativeTrackerAskValues
): Record<string, unknown> {
	const question = text.length ? text : values.question;
	const body = nativeTrackerAskBody(values);
	if (!isTrackerCosMessage(String(question ?? ''))) {
		requireStructuredAsk(values);
		requireSpec(String(question ?? ''), values);
	}
	return { question, force: values.force, ...body };
}

/** A flag is a question Daniel answers by tapping, so it must carry choices and a recommendation. */
function requireStructuredAsk(values: NativeTrackerAskValues): void {
	if (values.option !== undefined && values.recommend !== undefined) return;
	throw new TypeError(
		'tracker flag needs choices: --option "label=what happens" (2 to 4 times) and --recommend N. ' +
			'"Other" is added for you. For a dependency or other blocker with no decision, use tracker block. ' +
			'Scripts and monitors use tracker alert <id> "<message>".'
	);
}

/** A spec review is only answerable when the spec is attached for "View spec". */
function requireSpec(question: string, values: NativeTrackerAskValues): void {
	if (values.spec !== undefined || values.doc !== undefined) return;
	if (values['not-spec-review']) return;
	const labels = Array.isArray(values.option) ? values.option.map(String) : [];
	if (!isTrackerSpecReview(question, labels)) return;
	throw new TypeError(
		'a spec review must attach the spec: --spec owner/repo#PR:path/to/spec.md (or --doc file.md). ' +
			'If this is not a spec review, add --not-spec-review.'
	);
}

/** The body of `tracker answer`: free text, or a tapped option with its confirm step. */
export function nativeTrackerAnswerBody(answer: string, values: NativeTrackerAskValues) {
	return {
		answer: answer.length ? answer : undefined,
		option: values.option,
		confirmed: values.confirmed,
		done: values.done,
		keep_blocked: values['keep-blocked'],
		by: values.by
	};
}
