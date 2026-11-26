// @harness-uid u_47xjs4dkt5
import type { TrackerTmuxWindow } from '../../../utils/projects-sessions/trackerSessionNames.types';

/** Names only. A socket without a server, or a failed listing, contributes none. */
export async function trackerTmuxWindows(
	sockets: readonly string[],
	command: (socket: string, args: string[]) => Promise<{ code: number; stdout: string }>
): Promise<TrackerTmuxWindow[]> {
	const windows: TrackerTmuxWindow[] = [];
	for (const socket of sockets) {
		const result = await command(socket, [
			'list-windows',
			'-a',
			'-F',
			'#{session_name}\t#{window_name}'
		]);
		if (result.code !== 0) continue;
		for (const line of result.stdout.split('\n')) {
			const [session, window] = line.split('\t');
			if (session && window !== undefined) windows.push({ session, window });
		}
	}
	return windows;
}
