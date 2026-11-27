// @harness-uid u_gvqtr5mdwv
import { z } from 'zod';
import { TrackerGmailSendAdapter } from '../../../adapters/projects-sessions/TrackerGmailSendAdapter';
import {
	controlledTrackerExecutable,
	runTrackerHostCommand
} from '../../../adapters/projects-sessions/tracker-host-process-adapter/trackerHostCommand';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerNodeConfig } from './trackerNodeConfig.types';
import { readPrivateJson } from './trackerNodeConfig';

const gmailBinding = z.strictObject({ account: z.email(), tokenDriver: z.string().min(1) });

/** The approved driver returns a short-lived Gmail token directly to the reviewed transport. */
export function configuredOutgoingProvider(
	config: TrackerNodeConfig,
	path?: string
): TrackerNativeRuntimeOptions['outgoingProvider'] {
	if (config.role !== 'hub' || config.hostEffects?.mode === 'held' || !path) return undefined;
	const { account, tokenDriver } = gmailBinding.parse(readPrivateJson(path));
	const executable = controlledTrackerExecutable(tokenDriver);
	const adapter = new TrackerGmailSendAdapter({
		account,
		async readAccessToken(signal) {
			const result = await runTrackerHostCommand(executable, [], signal);
			if (result.code !== 0) throw new Error('Gmail send credential unavailable');
			return result.stdout;
		}
	});
	const send = adapter.send.bind(adapter);
	return (message) =>
		message.channel === 'gmail' && message.account === account ? send : undefined;
}
