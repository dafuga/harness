// @harness-uid u_r7qgepnoax
import type { NativeTrackerAskValues } from './nativeTrackerCli.types';
import { trackerAskOptionFromWord } from '../../../utils/projects-sessions/trackerAskOptions';
import { isTrackerPing } from '../../../utils/projects-sessions/isTrackerPing';

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
	if (!isTrackerPing(question)) requireStructuredAsk(values);
	return { question, force: values.force, ...body };
}

/** A flag is a question Daniel answers by tapping, so it must carry choices and a recommendation. */
function requireStructuredAsk(values: NativeTrackerAskValues): void {
	if (values.option !== undefined && values.recommend !== undefined) return;
	throw new TypeError(
		'tracker flag needs choices: --option "label=what happens" (2 to 4 times) and --recommend N. ' +
			'"Other" is added for you. For a dependency or other blocker with no decision, use tracker block.'
	);
}

/** The body of `tracker answer`: free text, or a tapped option with its confirm step. */
export function nativeTrackerAnswerBody(answer: string, values: NativeTrackerAskValues) {
	return {
		answer: answer.length ? answer : undefined,
		option: values.option,
		confirmed: values.confirmed,
		done: values.done,
		by: values.by
	};
}
