// @harness-uid u_r7qgepnoax
import type { NativeTrackerAskValues } from './nativeTrackerCli.types';
import { trackerAskOptionFromWord } from '../../../utils/projects-sessions/trackerAskOptions';

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

function recommendedNumber(value: unknown, count: number): number | undefined {
	if (value === undefined) return undefined;
	const number = Number(value);
	if (!Number.isInteger(number) || number < 1 || number > count)
		throw new TypeError(`--recommend must be 1 to ${count}`);
	return number;
}

/** The body of `tracker flag`: the question plus any choices. */
export function nativeTrackerFlagBody(
	text: string,
	values: NativeTrackerAskValues
): Record<string, unknown> {
	return {
		question: text.length ? text : values.question,
		force: values.force,
		...nativeTrackerAskBody(values)
	};
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
