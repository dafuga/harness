import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { link, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	agentBeatSchema,
	agentEndSchema,
	agentRegistrationSchema,
	type AgentBeat,
	type AgentEnd,
	type AgentRegistration
} from '../../core/activityTypes';

export interface StoredAgent {
	registration: AgentRegistration;
	beat: AgentBeat;
	end: AgentEnd | null;
}

const names = { registration: 'registration.json', beat: 'heartbeat.json', end: 'finished.json' };

async function parsed(path: string): Promise<unknown> {
	return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

/**
 * What agents state about themselves in one checkout, under its cache and outside what Git
 * tracks. Each agent has a directory with three files that are each written whole: who it is,
 * its latest heartbeat and its end. No file is ever read and written back, so agents that write
 * at once cannot lose or mix each other's words, and an end that was written stays.
 */
export class AgentRegistryRepository {
	private readonly directory: string;

	constructor(root: string) {
		this.directory = join(root, '.cache', 'harness', 'agents');
	}

	/** True once any agent has registered in this checkout. */
	used(): boolean {
		return existsSync(this.directory);
	}

	async register(registration: AgentRegistration, beat: AgentBeat): Promise<void> {
		const home = join(this.directory, registration.id);
		await mkdir(home, { recursive: true });
		// An agent that registers again starts over: an earlier end is not the end of this work.
		await rm(join(home, names.end), { force: true });
		await this.whole(join(home, names.beat), beat);
		// The registration is written last: an agent is listed only once all of it is there.
		await this.whole(join(home, names.registration), registration);
	}

	beat(id: string, beat: AgentBeat): Promise<void> {
		return this.whole(join(this.directory, id, names.beat), beat);
	}

	/** Writes the end unless one is there; the first end stands. False when it was there. */
	async finish(id: string, end: AgentEnd): Promise<boolean> {
		const target = join(this.directory, id, names.end);
		const draft = `${target}.${randomUUID()}.tmp`;
		await writeFile(draft, JSON.stringify(end));
		try {
			await link(draft, target);
			return true;
		} catch (error) {
			if ((error as { code?: string }).code === 'EEXIST') return false;
			throw error;
		} finally {
			await rm(draft, { force: true });
		}
	}

	/** One agent; undefined when it has not registered here. Damaged files make it throw. */
	async read(id: string): Promise<StoredAgent | undefined> {
		const home = join(this.directory, id);
		if (!existsSync(join(home, names.registration))) return undefined;
		const end = existsSync(join(home, names.end))
			? agentEndSchema.parse(await parsed(join(home, names.end)))
			: null;
		return {
			registration: agentRegistrationSchema.parse(await parsed(join(home, names.registration))),
			beat: agentBeatSchema.parse(await parsed(join(home, names.beat))),
			end
		};
	}

	/** Every registered agent, and how many registrations are there but cannot be read. */
	async all(): Promise<{ agents: StoredAgent[]; unreadable: number }> {
		const ids = this.used() ? await readdir(this.directory) : [];
		const agents: StoredAgent[] = [];
		let unreadable = 0;
		for (const id of ids.sort()) {
			try {
				const agent = await this.read(id);
				if (agent) agents.push(agent);
			} catch {
				unreadable += 1;
			}
		}
		return { agents, unreadable };
	}

	remove(id: string): Promise<void> {
		return rm(join(this.directory, id), { recursive: true, force: true });
	}

	/** Replaces a file in one step, so a reader sees the old words or the new, never a part. */
	private async whole(path: string, value: unknown): Promise<void> {
		const draft = `${path}.${randomUUID()}.tmp`;
		await writeFile(draft, JSON.stringify(value));
		await rename(draft, path);
	}
}
