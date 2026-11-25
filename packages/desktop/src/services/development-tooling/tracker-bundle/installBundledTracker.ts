// @harness-uid u_tb8wj3mrxk
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { TrackerBundleInput, TrackerBundleOutcome } from './TrackerBundleService.types';
import { bundledTrackerFiles, trackerBundleLayout } from './trackerBundleLayout';
import type { TrackerBundleLayout } from './trackerBundleLayout.types';
import { stageTrackerRelease } from './stageTrackerRelease';
import { inspectLink, replaceSymlink } from './replaceSymlink';
import { recordRelease, withLock } from './trackerBundleRecord';
import { activateService } from './activateTrackerService';
import { isTrackerServe, readAgentProgram } from './trackerLaunchAgent';

async function present(path: string): Promise<boolean> {
	return access(path).then(
		() => true,
		() => false
	);
}

/** The links this bundle owns. A file or directory someone else put there is never replaced. */
async function foreignEntry(layout: TrackerBundleLayout): Promise<string | null> {
	for (const path of [layout.launcher, layout.entry])
		if ((await inspectLink(path)).kind === 'other') return path;
	return null;
}

/**
 * Installs or updates the Tracker that ships inside Harness.app. The service keeps its
 * configuration, role, database and logs; only the executable it runs changes, and a release
 * that does not become ready is replaced by the one that was running.
 */
export async function installBundledTracker(
	input: TrackerBundleInput
): Promise<TrackerBundleOutcome> {
	const files = bundledTrackerFiles(input.app);
	if (!(await present(files.executable)) || !(await present(files.shim)))
		return { status: 'not-bundled' };
	const layout = trackerBundleLayout(input.home);
	const outcome = await withLock(layout.lock, () => apply(input, layout, files));
	return outcome ?? { status: 'refused', reason: 'Another Tracker install is running.' };
}

async function apply(
	input: TrackerBundleInput,
	layout: TrackerBundleLayout,
	files: ReturnType<typeof bundledTrackerFiles>
): Promise<TrackerBundleOutcome> {
	const program = await readAgentProgram(layout.agent, input.host);
	if (program !== null && !isTrackerServe(program))
		return { status: 'refused', reason: 'The Tracker LaunchAgent is not a Tracker service.' };
	const foreign = await foreignEntry(layout);
	if (foreign) return { status: 'refused', reason: `${foreign} is not a link this app owns.` };
	const staged = await stageTrackerRelease(files, layout.releases, input.revision);
	const executable = join(staged.directory, 'harness');
	const before = {
		launcher: await inspectLink(layout.launcher),
		entry: await inspectLink(layout.entry)
	};
	await replaceSymlink(layout.launcher, executable);
	await replaceSymlink(layout.entry, join(staged.directory, 'tracker-shim.sh'));
	const result = await activateService({ input, layout, program, executable, before });
	if (result.status === 'rolled-back') return { ...result, release: staged.id };
	const record = { file: layout.record, releases: layout.releases, revision: input.revision };
	await recordRelease(record, staged.id, result.previousRelease ? [result.previousRelease] : []);
	if (result.outcome === 'cli-only')
		return { status: 'cli-only', release: staged.id, reason: 'no-configuration' };
	if (result.outcome === 'current') return { status: 'current', release: staged.id };
	return {
		status: 'installed',
		release: staged.id,
		previous: result.previousRelease,
		restarted: result.restarted
	};
}
