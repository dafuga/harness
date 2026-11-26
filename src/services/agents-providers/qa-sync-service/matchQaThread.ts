// @harness-uid u_4zg3zprxrv
import type { QaSlackMessage, QaSyncConfig } from '../../../core/agents-providers/qaSync.types';
import type { QaThreadMatch } from './matchQaThread.types';

/**
 * @pure A parent is a QA thread when a configured author wrote it and its first line holds the
 * heading marker followed by an issue number. Issue links, when present, must include it.
 */
export function matchQaThread(parent: QaSlackMessage, config: QaSyncConfig): QaThreadMatch {
	const authors = config.threads.authors;
	if (!authors.includes(parent.user ?? '') && !authors.includes(parent.botId ?? ''))
		return { kind: 'other' };
	const heading = parent.text.split('\n', 1)[0];
	const at = heading.indexOf(config.threads.headingMarker);
	if (at < 0) return { kind: 'other' };
	const number = /^\d{1,9}/.exec(heading.slice(at + config.threads.headingMarker.length));
	if (!number) return { kind: 'other' };
	const issue = Number(number[0]);
	const linked = issueLinks(parent.text, config);
	return linked.length && !linked.includes(issue)
		? { kind: 'ambiguous', issue, linked }
		: { kind: 'qa', issue };
}

function issueLinks(text: string, { github }: QaSyncConfig): number[] {
	const repo = `${github.owner}/${github.repo}`.replaceAll('.', '\\.');
	const links = new RegExp(`https://github\\.com/${repo}/issues/(\\d{1,9})`, 'gi');
	return [...text.matchAll(links)].map((match) => Number(match[1]));
}
