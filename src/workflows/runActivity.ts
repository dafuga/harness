import { resolve } from 'node:path';
import { GitAdapter } from '../adapters/GitAdapter';
import type { AgentRoster, LiveActivity, ProjectActivity } from '../core/activityTypes';
import { fail } from '../core/errors';
import { ProjectWorkRepository } from '../repositories/ProjectWorkRepository';
import { AgentActivityService } from '../services/agent-activity-service/AgentActivityService';
import { ProjectActivityService } from '../services/project-activity-service/ProjectActivityService';
import type { AgentInput } from '../utils/agentStatement';

export interface Shown {
	activity: ProjectActivity;
	live: LiveActivity;
}

/** The checkout a command runs in: the top of its Git checkout, or the directory outside Git. */
export async function activityRoot(directory = process.cwd()): Promise<string> {
	const top = await new GitAdapter(directory).attempt(['rev-parse', '--show-toplevel']);
	return top ?? resolve(directory);
}

async function agents(): Promise<AgentActivityService> {
	const root = await activityRoot();
	return new AgentActivityService(root, await new ProjectWorkRepository(root).checkouts());
}

export async function showActivity(options: { limit?: string } = {}): Promise<Shown> {
	const limit = Number(options.limit ?? 20);
	if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
		return fail('--limit must be a whole number from 1 to 200.');
	}
	return new ProjectActivityService(await activityRoot()).show(limit);
}

export async function registerAgent(input: AgentInput) {
	const { registration, beat } = await (await agents()).register(input);
	const { id, registeredAt, ttlSeconds } = registration;
	return { id, branch: beat.branch, registeredAt, ttlSeconds };
}

export async function beatAgent(id: string, input: AgentInput) {
	return { id, ...(await (await agents()).heartbeat(id, input)) };
}

export async function finishAgent(id: string, options: { failed?: boolean; outcome?: string }) {
	await (await agents()).finish(id, options.failed === true, options.outcome);
	return { id, status: options.failed ? 'failed' : 'completed' };
}

/**
 * A heartbeat from a command an agent ran: when HARNESS_AGENT_ID names a registered agent, every
 * Harness command it runs is a sign of work. It never fails the command it follows.
 */
export async function beatFromEnvironment(env = process.env): Promise<void> {
	const id = env.HARNESS_AGENT_ID?.trim();
	if (!id) return;
	await beatAgent(id, {}).catch(() => undefined);
}

export async function listAgents(): Promise<AgentRoster> {
	return (await agents()).roster();
}

export function renderRoster(roster: AgentRoster): string {
	if (roster.tracking === 'never-used') {
		return 'No agent has registered in this repository, so who is working is not known.';
	}
	const lines = roster.roster.map((agent) => {
		const who = [agent.provider, agent.model].filter(Boolean).join(' · ') || 'model not stated';
		const where = `${agent.worktree} · branch ${agent.branch ?? 'none'}`;
		return `  ${agent.state.padEnd(9)} ${agent.label} (${who}) in ${where}: ${agent.detail}`;
	});
	const unread = roster.unreadable ? [`${roster.unreadable} registrations could not be read.`] : [];
	return [`${roster.working} registered agents are working now.`, ...lines, ...unread].join('\n');
}

export function renderShown({ activity, live }: Shown): string {
	const { name, branch, head } = activity.repository;
	const loops = activity.loops.types.map(
		(type) => `  ${type.template}: ${type.loops} loops, ${type.complete} complete`
	);
	const work = activity.work.map(
		(item) => `  ${item.commit.slice(0, 7)} ${item.committedAt} ${item.subject}`
	);
	const open = live.worktrees.map(
		(tree) => `  ${tree.name} (${tree.branch ?? 'no branch'}): ${tree.changes.length} uncommitted`
	);
	return [
		`${name} · branch ${branch ?? 'none'} · ${head?.slice(0, 7) ?? 'no commit'}`,
		'Loop types:',
		...loops,
		'Recent work:',
		...work,
		'Checkouts:',
		...open,
		renderRoster(live.agents)
	].join('\n');
}
