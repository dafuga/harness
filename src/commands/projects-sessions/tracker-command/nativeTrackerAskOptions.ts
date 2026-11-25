// @harness-uid u_r7qgepnoax
import { trackerAskOptionFromWord } from '../../../utils/projects-sessions/trackerAskOptions';

/** The ask-choice words of one command line: `--option label=effect` (repeat), `--recommend N`. */
export function nativeTrackerAskBody(values: Record<string, unknown>): Record<string, unknown> {
	const words = values.option;
	if (words === undefined) {
		if (values.recommend !== undefined) throw new TypeError('--recommend needs --option');
		return values.confirm === undefined ? {} : { confirm: values.confirm };
	}
	if (!Array.isArray(words) || words.length < 2 || words.length > 4)
		throw new TypeError('give 2 to 4 --option "label=what happens" words');
	const recommend = values.recommend === undefined ? undefined : Number(values.recommend);
	if (
		recommend !== undefined &&
		!(Number.isInteger(recommend) && recommend >= 1 && recommend <= words.length)
	)
		throw new TypeError(`--recommend must be 1 to ${words.length}`);
	const options = words.map((word, index) => ({
		...trackerAskOptionFromWord(String(word)),
		...(recommend === index + 1 ? { recommended: true } : {})
	}));
	return { options, ...(values.confirm === undefined ? {} : { confirm: values.confirm }) };
}
