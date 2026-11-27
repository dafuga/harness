// @harness-uid u_56btduubcj
import type { NeedsYouPushMessage } from '../../../utils/projects-sessions/webPushContract.types';
import type { PushAsk } from './webPush.types';

const listed = 3;

const clip = (text: string, length: number) => {
	const line = text.replace(/\s+/g, ' ').trim();
	return line.length > length ? `${line.slice(0, length - 1).trimEnd()}…` : line;
};

const projectName = ({ project }: PushAsk) =>
	clip(project === 'cos' ? 'Chief of Staff' : project, 40);

/** One summary of every open ask. Callers pass at least one, oldest first. */
export function needsYouPushMessage(asks: PushAsk[]): NeedsYouPushMessage {
	const [first] = asks;
	if (asks.length === 1)
		return {
			title: `${projectName(first)} needs you`,
			body: clip(first.question, 240),
			needs: first.itemId
		};
	const lines = asks
		.slice(0, listed)
		.map((ask) => clip(`${projectName(ask)}: ${ask.question}`, 90));
	if (asks.length > listed) lines.push(`+${asks.length - listed} more`);
	return { title: `${asks.length} decisions need you`, body: lines.join('\n'), needs: 'all' };
}
