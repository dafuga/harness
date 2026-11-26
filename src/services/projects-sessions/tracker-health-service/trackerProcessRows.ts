// @harness-uid u_merv2wcs5p
import type { TrackerHealthProcess } from '../TrackerHealthService.types';

const row = /^\s*(\d+)\s+(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)\s+(.*)$/;

/** @pure Parse `ps -o pid=,etime=,command=` rows; commands keep a trailing space for whole-word matching. */
export function trackerProcessRows(output: string): TrackerHealthProcess[] {
	return output.split('\n').flatMap((line) => {
		const match = row.exec(line);
		if (!match) return [];
		const [, pid, days = '0', hours = '0', minutes, , command] = match;
		const ageMinutes = Number(days) * 1440 + Number(hours) * 60 + Number(minutes);
		return [{ pid: Number(pid), ageMinutes, command: `${command} ` }];
	});
}
