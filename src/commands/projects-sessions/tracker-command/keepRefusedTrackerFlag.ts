// @harness-uid u_r7qgepnoax
import { parseArgs } from 'node:util';
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import { fetchNativeTracker } from './fetchNativeTracker';
import { nativeTrackerCommandOptions, nativeTrackerCommonOptions } from './nativeTrackerOptions';

/**
 * A refused `tracker flag` may be a monitor's only report, and its caller may discard stderr. Send
 * the words to Chief of Staff before failing, and say plainly whether that worked.
 */
export async function keepRefusedTrackerFlag(
	args: string[],
	refused: string,
	{ config, actor }: { config: TrackerNodeConfig; actor: string }
): Promise<void> {
	const { target, text } = refusedWords(args);
	const request = {
		method: 'POST' as const,
		path: `/items/${encodeURIComponent(target)}/alert`,
		body: { text, refused }
	};
	const kept = await fetchNativeTracker(config, request, actor).then(
		(response) => response.ok,
		() => false
	);
	console.error(kept ? keptMessage : lostMessage);
}

const keptMessage =
	'tracker: Daniel was not asked. The refused flag is kept for Chief of Staff. ' +
	'Scripts and monitors use: tracker alert <id> "<message>"';
const lostMessage =
	'tracker: the refused flag could not be recorded, so nobody has seen it. Retry with tracker alert.';

/** Read the words leniently: the strict parser may be what refused them. */
function refusedWords(args: string[]): { target: string; text: string } {
	const { values, positionals } = parseArgs({
		args: args.slice(1),
		allowPositionals: true,
		strict: false,
		options: { ...nativeTrackerCommonOptions, ...nativeTrackerCommandOptions.get('flag') }
	});
	const [first = '', ...rest] = positionals;
	const named = /^[\w-]{1,40}$/.test(first);
	const words = (named ? rest : positionals).join(' ') || String(values.question ?? '');
	return { target: named ? first : 'unknown', text: words || '(a flag with no question)' };
}
