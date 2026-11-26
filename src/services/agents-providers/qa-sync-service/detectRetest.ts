// @harness-uid u_ms65n355vn
import type { QaSyncConfig } from '../../../core/agents-providers/qaSync.types';

const retestRequests: readonly RegExp[] = [
	/^\W*(?:please\s+)?re-?test(?:\s*[:!.-]|\s+(?:on|in|please)\b|\s*$)/,
	/\b(?:please|pls|plz|(?:can|could|would) (?:you|someone)(?: please)?)\s+(?:re-?test\b|(?:test|check|verify)\b[^.!?]*\bagain\b)/,
	/\bready\s+(?:for|to)\s+(?:be\s+)?(?:(?:re-?)?test(?:ed|ing)?|re-?check|qa)\b/,
	/\bneeds?\s+(?:a\s+|to\s+be\s+)?(?:re-?test(?:ed|ing)?|testing|tested)\b/
];
const negated =
	/\b(?:no|not|never|without|don'?t|doesn'?t|isn'?t|aren'?t|won'?t|can'?t|cannot)\b[^,;]{0,30}?\b(?:re-?test|re-?check|test|testing|tested|ready|needs?|qa)/;

/**
 * @pure The environments a message asks to have retested, or none. Quoted and code text is
 * ignored, and a negated sentence never counts.
 */
export function detectRetest(text: string, retest: QaSyncConfig['retest']): string[] {
	const requests = sentences(text).filter(
		(sentence) =>
			!negated.test(sentence) && retestRequests.some((pattern) => pattern.test(sentence))
	);
	if (!requests.length) return [];
	const named = (scope: string) =>
		Object.entries(retest.environments).flatMap(([name, words]) =>
			words.some((word) => new RegExp(`\\b${word.toLowerCase()}\\b`).test(scope)) ? [name] : []
		);
	const inRequest = named(requests.join(' '));
	if (inRequest.length) return inRequest;
	const anywhere = named(sentences(text).join(' '));
	return anywhere.length === 1 ? anywhere : [retest.defaultEnvironment];
}

function sentences(text: string): string[] {
	return text
		.replace(/```[\s\S]*?```|`[^`\n]*`/g, ' ')
		.replace(/^\s*(?:>|&gt;).*$/gm, ' ')
		.replace(/<[^>|]*\|([^>]*)>/g, '$1')
		.replace(/<[^>]*>/g, ' ')
		.replaceAll('’', "'")
		.toLowerCase()
		.split(/\n|(?<=[.!?])\s+|\bbut\b/)
		.map((sentence) => sentence.trim())
		.filter(Boolean);
}
