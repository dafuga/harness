// @harness-uid u_dzcerery3f
import type { DesktopIpcPort } from '../../../../utils/agents-providers/desktopIpc';
import { bootstrapChannel } from '../../../../utils/agents-providers/desktopIpc';
import type { LocalBootstrap } from '../../../../../../remote/src/index';
import { UntrustedRendererError } from './desktopIpc.types';

/** `bootstrap` answers for the trusted top frame of a window and returns null for anyone else. */
export function desktopIpc(
	port: DesktopIpcPort,
	bootstrap: (event: unknown) => LocalBootstrap | null
): () => void {
	port.handle(bootstrapChannel, async (event) => {
		const answer = bootstrap(event);
		if (!answer) throw new UntrustedRendererError('Untrusted renderer.');
		return answer;
	});
	return () => port.removeHandler(bootstrapChannel);
}
