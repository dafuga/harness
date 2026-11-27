// @harness-uid u_rasgr3cqn3
// @harness-uid u_tb9xk4nsyl
import { rm } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type { ActivateInput, Activation, LinkState } from './activateTrackerService.types';
import { TrackerBundleError } from './TrackerBundleError';
import { replaceSymlink } from './replaceSymlink';
import {
	agentLoaded,
	configuredRole,
	createAgent,
	reloadAgent,
	setAgentExecutable
} from './trackerLaunchAgent';

function releaseOf(executable: string | undefined, releases: string): string | null {
	return executable && dirname(dirname(executable)) === releases
		? basename(dirname(executable))
		: null;
}

function configOf(program: string[] | null, fallback: string): string {
	const flag = program?.indexOf('--config') ?? -1;
	return (flag >= 0 ? program?.[flag + 1] : undefined) ?? fallback;
}

async function waitReady(a: ActivateInput): Promise<void> {
	const { host, home, readyAttempts = 30 } = a.input;
	const env = { HOME: home, HARNESS_TRACKER_CONFIG: configOf(a.program, a.layout.config) };
	for (let attempt = 1; attempt <= readyAttempts; attempt++) {
		if ((await host.run(a.executable, ['tracker', 'ensure'], env)).status === 0) return;
		await host.sleep(1000);
	}
	throw new TrackerBundleError('The Tracker service did not become ready.');
}

async function restoreLink(path: string, state: LinkState): Promise<void> {
	if (state.kind === 'link') await replaceSymlink(path, state.target);
	else if (state.kind === 'absent') await rm(path, { force: true });
}

async function rollBack(a: ActivateInput, reason: string): Promise<Activation> {
	const { host } = a.input;
	await restoreLink(a.layout.launcher, a.before.launcher);
	await restoreLink(a.layout.entry, a.before.entry);
	if (a.program === null) {
		await rm(a.layout.agent, { force: true });
		await reloadAgent(a.layout.agent, host, 0);
	} else {
		await setAgentExecutable(a.layout.agent, a.program[0], host);
		await reloadAgent(a.layout.agent, host);
	}
	return { status: 'rolled-back', reason };
}

async function installAgent(a: ActivateInput, role: 'hub' | 'spoke' | null): Promise<void> {
	const { layout, executable } = a;
	const { host, home } = a.input;
	if (a.program === null && role !== null)
		await createAgent(
			{ agent: layout.agent, executable, config: layout.config, role, home, logs: layout.logs },
			host
		);
	else await setAgentExecutable(layout.agent, executable, host);
	await reloadAgent(layout.agent, host);
	await waitReady(a);
}

/** Points the service at the new release and waits for it; on failure restores the old one. */
export async function activateService(a: ActivateInput): Promise<Activation> {
	const previousRelease = releaseOf(a.program?.[0], a.layout.releases);
	const done = (outcome: 'current' | 'installed' | 'cli-only', restarted: boolean): Activation => ({
		status: 'ok',
		outcome,
		restarted,
		previousRelease
	});
	if (a.program?.[0] === a.executable && (await agentLoaded(a.input.host)))
		return done('current', false);
	const role = a.program === null ? await configuredRole(a.layout.config) : null;
	if (a.program === null && role === null) return done('cli-only', false);
	try {
		await installAgent(a, role);
	} catch (error) {
		return rollBack(a, error instanceof Error ? error.message : 'The update failed.');
	}
	return done('installed', true);
}
