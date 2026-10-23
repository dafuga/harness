import type { RosterContext } from './AgentActivityService.types';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ProcessIdentityAdapter } from './ProcessIdentityAdapter';
import type {
	AgentBeat,
	AgentEntry,
	AgentRoster,
	AgentState
} from '../../../core/projects-sessions/activityTypes';
import { fail } from '../../../core/development-tooling/errors';
import { AgentRegistryRepository, type StoredAgent } from './AgentRegistryRepository';
import type { Checkout } from '../../../repositories/projects-sessions/ProjectWorkRepository';
import { agentLiveness } from './agentLiveness';
import {} from '../../../utils/agents-providers/agentLiveness';
import { agentStatement } from './agentStatement';
import {
	type AgentInput,
	type AgentStatement
} from '../../../utils/agents-providers/agentStatement';

const order: AgentState[] = ['working', 'stale', 'gone', 'failed', 'completed'];

const day = 24 * 60 * 60 * 1000;

/** An agent that is not working is shown for a day and kept for a week. */
const shownFor = day;

const keptFor = 7 * day;

/**
 * The agents of a repository as they describe themselves. An agent registers in the checkout it
 * works in, says it is still working with heartbeats and says when it ends; nothing about it is
 * read from its conversation or guessed from the machine. Whether it is working now is decided
 * when asked, from those words and from the process its owner named.
 */
export class AgentActivityService {
	private readonly registry: AgentRegistryRepository;
	private readonly processes = new ProcessIdentityAdapter();

	/** `root` is the checkout an agent registers in; `checkouts` are all of its repository. */
	constructor(
		private readonly root: string,
		private readonly checkouts: Checkout[]
	) {
		this.registry = new AgentRegistryRepository(root);
	}

	async register(input: AgentInput): Promise<StoredAgent> {
		const stated = agentStatement(input);
		const { label } = stated;
		if (!label) return fail('--label must say who the agent is.');
		const found = stated.pid === null ? undefined : this.processes.find(stated.pid);
		if (found?.exists === false) return fail(`No process ${stated.pid} is running.`);
		const own = this.checkouts.find((checkout) => checkout.path === this.root);
		const context = {
			at: new Date().toISOString(),
			branch: own?.branch ?? null,
			started: found?.startedAt ?? null
		};
		const agent = registered({ ...stated, label }, context);
		await this.forget();
		await this.registry.register(agent.registration, agent.beat);
		return agent;
	}

	/** A sign of work. What is restated replaces what was said; the rest stays as it was. */
	async heartbeat(id: string, input: AgentInput): Promise<AgentBeat> {
		const { agent, checkout, registry } = await this.known(id);
		const stated = agentStatement(input);
		const beat = {
			at: new Date().toISOString(),
			branch: checkout.branch,
			task: stated.task ?? agent.beat.task,
			loop: stated.loop ?? agent.beat.loop,
			units: stated.units ?? agent.beat.units
		};
		await registry.beat(id, beat);
		return beat;
	}

	async finish(id: string, failed: boolean, outcome?: string): Promise<void> {
		const { registry } = await this.known(id);
		const stated = agentStatement({ outcome });
		const status = failed ? ('failed' as const) : ('completed' as const);
		const end = { at: new Date().toISOString(), status, outcome: stated.outcome ?? null };
		if (!(await registry.finish(id, end))) fail(`${id} has finished already.`);
	}

	/** Every agent registered in a checkout of the repository, the working ones first. */
	async roster(): Promise<AgentRoster> {
		const context = {
			known: await unitIds(this.root),
			now: Date.now(),
			processOf: (pid: number) => this.processes.find(pid)
		};
		const { now } = context;
		const entries: AgentEntry[] = [];
		let [used, unreadable] = [false, 0];
		for (const checkout of this.checkouts) {
			const registry = new AgentRegistryRepository(checkout.path);
			used ||= registry.used();
			const read = await registry.all();
			unreadable += read.unreadable;
			for (const agent of read.agents) entries.push(rosterEntry(agent, checkout, context));
		}
		if (!used) return { tracking: 'never-used', working: null, unreadable: 0, roster: [] };
		const recent = (entry: AgentEntry) =>
			entry.state === 'working' ||
			now - Date.parse(entry.finishedAt ?? entry.heartbeatAt) <= shownFor;
		const roster = entries
			.filter(recent)
			.sort(
				(left, right) =>
					order.indexOf(left.state) - order.indexOf(right.state) ||
					right.heartbeatAt.localeCompare(left.heartbeatAt)
			);
		const working = roster.filter((entry) => entry.state === 'working').length;
		return { tracking: 'available', working, unreadable, roster };
	}

	/** The agent with this id in a checkout of the repository; one that has ended is refused. */
	private async known(
		id: string
	): Promise<{ agent: StoredAgent; checkout: Checkout; registry: AgentRegistryRepository }> {
		for (const checkout of /^[\w.-]+$/.test(id) ? this.checkouts : []) {
			const registry = new AgentRegistryRepository(checkout.path);
			const agent = await registry.read(id);
			if (agent?.end) return fail(`${id} has finished; register again to go on working.`);
			if (agent) return { agent, checkout, registry };
		}
		return fail(`${id} is not registered in this repository.`);
	}

	/** Removes registrations of this checkout that said nothing for a week. */
	private async forget(): Promise<void> {
		const { agents } = await this.registry.all();
		const old = agents.filter((agent) => Date.now() - lastWord(agent) > keptFor);
		await Promise.all(old.map((agent) => this.registry.remove(agent.registration.id)));
	}
}

/** When an agent last said anything: its end, or else its latest heartbeat. */
function lastWord(agent: StoredAgent): number {
	return Date.parse(agent.end?.at ?? agent.beat.at);
}

/** A registration and its first heartbeat, from what was stated; what was not stated is null. */
function registered(
	stated: AgentStatement & { label: string },
	context: { at: string; branch: string | null; started: string | null }
): StoredAgent {
	const { provider = null, model = null, task = null, loop = null, units = [] } = stated;
	const registration = {
		schemaVersion: 1 as const,
		id: stated.id ?? randomUUID(),
		label: stated.label,
		...{ provider, model, pid: stated.pid, processStartedAt: context.started },
		registeredAt: context.at,
		ttlSeconds: stated.ttlSeconds
	};
	const beat = { at: context.at, branch: context.branch, task, loop, units };
	return { registration, beat, end: null };
}

/** One agent as the roster shows it: what it stated, where, and whether it is working now. */
function rosterEntry(agent: StoredAgent, checkout: Checkout, context: RosterContext): AgentEntry {
	const { registration, beat, end } = agent;
	const facts = { ...registration, heartbeatAt: beat.at, finished: end };
	const { state, detail } = agentLiveness(facts, context.now, context.processOf);
	const { id, label, provider, model, registeredAt } = registration;
	return {
		...{ id, label, provider, model, registeredAt },
		worktree: basename(checkout.path),
		...{ branch: beat.branch, task: beat.task, loop: beat.loop, units: beat.units },
		unknownUnits: beat.units.filter((unit) => !context.known.has(unit)),
		heartbeatAt: beat.at,
		expiresAt: new Date(Date.parse(beat.at) + registration.ttlSeconds * 1000).toISOString(),
		...{ state, detail },
		...(end ? { finishedAt: end.at, ...(end.outcome ? { outcome: end.outcome } : {}) } : {})
	};
}

/** The ids of the unit registry of a checkout; empty where there is none. */
async function unitIds(root: string): Promise<Set<string>> {
	const directory = join(root, 'specification', 'units');
	const files = existsSync(directory) ? await readdir(directory) : [];
	return new Set(files.filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)));
}
