// @harness-uid u_r7qgepnoax
import { readTrackerJsonFile } from './readTrackerJsonFile';
import { trackerArtifactMaxBytes } from '../../../utils/projects-sessions/trackerPlanning';
import type { NativeTrackerRequest } from './nativeTrackerCli.types';

export function nativeTrackerPlanningRequest(
	command: 'stage' | 'artifact',
	id: string,
	[stage, file, ...rest]: string[]
): NativeTrackerRequest {
	const usage = `usage: tracker ${command} <id> idea|detail|design|build${command === 'artifact' ? ' <file>' : ''}`;
	if (!id || !stage || (command === 'stage' ? file : !file || rest.length))
		throw new TypeError(usage);
	return {
		method: 'POST',
		path: `/items/${encodeURIComponent(id)}/${command}`,
		body:
			command === 'stage'
				? { stage }
				: {
						stage,
						artifact: readTrackerJsonFile(file, trackerArtifactMaxBytes * 2, 'planning artifact')
					}
	};
}
