import type { DesktopIpcPort } from '../../utils/desktopIpc';
import { bootstrapChannel } from '../../utils/desktopIpc';
import type { LocalBootstrap } from '../../../../remote/src/index';

/** `bootstrap` answers for the trusted top frame of a window and returns null for anyone else. */
export function desktopIpc(
	port: DesktopIpcPort,
	bootstrap: (event: unknown) => LocalBootstrap | null
): () => void {
	port.handle(bootstrapChannel, async (event) => {
		const answer = bootstrap(event);
		if (!answer) throw new Error('Untrusted renderer.');
		return answer;
	});
	return () => port.removeHandler(bootstrapChannel);
}
