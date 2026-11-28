// @harness-uid u_r7qgepnoax
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import { trackerArtifactMaxBytes } from '../../../utils/projects-sessions/trackerPlanning';
import type { NativeTrackerRequest } from './nativeTrackerCli.types';

export function nativeTrackerPlanningRequest(
	command: 'stage' | 'artifact',
	id: string,
	[stage, file, ...rest]: string[],
	mergeLinks = false
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
				: { stage, artifact: readPlanningArtifact(file), ...(mergeLinks && { merge_links: true }) }
	};
}

function readPlanningArtifact(file: string): unknown {
	try {
		const fd = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK);
		try {
			const info = fstatSync(fd);
			const limit = trackerArtifactMaxBytes * 2;
			if (!info.isFile() || info.size > limit) throw new TypeError('invalid artifact file');
			const buffer = Buffer.alloc(limit + 1);
			const size = readSync(fd, buffer, 0, buffer.length, 0);
			if (size > limit) throw new TypeError('invalid artifact file');
			return JSON.parse(buffer.subarray(0, size).toString('utf8'));
		} finally {
			closeSync(fd);
		}
	} catch {
		throw new TypeError('could not read planning artifact JSON file');
	}
}
