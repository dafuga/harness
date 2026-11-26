import { constants } from 'node:fs';
import { open, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { trackerClaudeSessionId } from '../../../utils/projects-sessions/trackerClaudeSessionId';
import { trackerClaudeTokenUsage } from '../../../utils/agents-providers/trackerClaudeTokenUsage';
import { attemptKey } from '../../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import { trackerManagedToken } from './trackerManagedLaunchReceipt';
import type { TrackerHostLaunchPort } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';

const transcriptBytes = 256 * 1024 * 1024;

/** Read token counters from the transcripts of the attempt's own Claude session id. */
export function trackerManagedClaudeUsage(
	projects: string
): NonNullable<TrackerHostLaunchPort['readUsage']> {
	const cache = new Map<string, { stamp: string; lines: string[] }>();
	return async (run, signal) => {
		const attempt = trackerManagedToken(run.node, attemptKey(run));
		const session = trackerClaudeSessionId(attempt);
		if (run.cli !== 'claude' || run.session_id !== attempt || !session) return undefined;
		const lines: string[] = [];
		for (const path of await sessionTranscripts(projects, session)) {
			signal.throwIfAborted();
			lines.push(...(await usageLines(path, cache)));
		}
		return trackerClaudeTokenUsage(lines);
	};
}

/** The main transcript and any subagent transcripts. The directory name follows the cwd. */
async function sessionTranscripts(projects: string, session: string): Promise<string[]> {
	const paths: string[] = [];
	for (const project of await readdir(projects).catch(() => [])) {
		const directory = join(projects, project);
		const names = await readdir(directory).catch(() => [] as string[]);
		if (names.includes(`${session}.jsonl`)) paths.push(join(directory, `${session}.jsonl`));
		if (!names.includes(session)) continue;
		const agents = join(directory, session, 'subagents');
		for (const name of await readdir(agents).catch(() => []))
			if (name.endsWith('.jsonl')) paths.push(join(agents, name));
	}
	return paths;
}

/** Only lines carrying usage are kept, and an unchanged file is not read again. */
async function usageLines(path: string, cache: Map<string, { stamp: string; lines: string[] }>) {
	const file = await open(
		path,
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
	).catch(() => undefined);
	if (!file) return [];
	try {
		const stat = await file.stat();
		if (!stat.isFile() || stat.uid !== process.getuid?.() || stat.size > transcriptBytes) return [];
		const stamp = `${stat.size}:${stat.mtimeMs}`;
		const known = cache.get(path);
		if (known?.stamp === stamp) return known.lines;
		const lines: string[] = [];
		for await (const line of file.readLines({ autoClose: false }))
			if (line.includes('"usage"')) lines.push(usageOnly(line));
		cache.set(path, { stamp, lines });
		return lines;
	} finally {
		await file.close();
	}
}

/** Drop message text before anything is held in memory. */
function usageOnly(line: string): string {
	try {
		const { id, model, usage } = JSON.parse(line).message ?? {};
		return JSON.stringify({ id, model, usage });
	} catch {
		return '';
	}
}
