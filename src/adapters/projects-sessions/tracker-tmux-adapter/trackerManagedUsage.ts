// @harness-uid u_2uiucmiztr
import { homedir } from 'node:os';
import { join } from 'node:path';
import { trackerManagedClaudeUsage } from './trackerManagedClaudeUsage';
import { trackerManagedCodexUsage } from './trackerManagedCodexUsage';
import type { TrackerHostLaunchPort } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';

/** Final counters for native macOS runs. Claude runs under the service user's own home. */
export function trackerManagedUsage(
	directory: string,
	profile: string | undefined,
	transcriptRoots: readonly string[]
): TrackerHostLaunchPort['readUsage'] {
	const codex = trackerManagedCodexUsage(directory, profile, transcriptRoots);
	if (!codex) return undefined;
	const claude = trackerManagedClaudeUsage(join(homedir(), '.claude', 'projects'));
	return (run, signal) => (run.cli === 'claude' ? claude(run, signal) : codex(run, signal));
}
