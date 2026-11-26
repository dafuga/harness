import { trackerEgressArguments } from '../../../utils/projects-sessions/trackerEgressPolicy';
import type { TrackerEgressPolicy } from '../../../utils/projects-sessions/trackerEgressPolicy.types';
import type { TrackerNativeLaunch } from './trackerManagedHostLauncher.types';

/**
 * Permission and session flags: skip prompts, name the session for Remote Control, fix its id so
 * its transcript can be found, and keep in-session model switches away from Fable unless the run
 * itself is on Fable.
 */
export function claudeSessionArguments(
	model: string,
	{ sessionName, claudeSession }: TrackerNativeLaunch,
	egress?: TrackerEgressPolicy
): string[] {
	const availableModels = ['opus', 'sonnet', 'haiku', ...(/fable/i.test(model) ? ['fable'] : [])];
	const session = claudeSession ? ['--session-id', claudeSession] : [];
	if (!egress)
		return [
			'--dangerously-skip-permissions',
			...(sessionName ? ['--remote-control', sessionName] : []),
			...session,
			'--settings',
			JSON.stringify({ availableModels })
		];
	// An egress-restricted session gets no remote channel. Claude takes one --settings value.
	const restricted = trackerEgressArguments('claude', egress);
	const at = restricted.indexOf('--settings') + 1;
	restricted[at] = JSON.stringify({ ...JSON.parse(restricted[at]), availableModels });
	return [...restricted, '--dangerously-skip-permissions', ...session];
}
