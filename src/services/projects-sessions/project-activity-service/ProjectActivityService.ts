import type { Owners, Reason, RecordedDetail } from './ProjectActivityService.types';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type {
	LiveActivity,
	ProjectActivity,
	WorktreeState
} from '../../../core/projects-sessions/activityTypes';
import {
	ProjectWorkRepository,
	type Checkout,
	type PathChange
} from '../../../repositories/projects-sessions/ProjectWorkRepository';
import {
	SourceHistoryRepository,
	type SourceHistory
} from '../../../repositories/git-source-history/source-history-repository/SourceHistoryRepository';
import { projectActivity } from './projectActivity';
import { unitOwners, type OwnedSource } from '../../../utils/development-tooling/unitOwners';
import { AgentActivityService } from '../../agents-providers/agent-activity-service/AgentActivityService';
import { HistoryStatusService } from '../../verification-evidence/history-status-service/HistoryStatusService';

/** How much of a project is shown: its newest commits, files, reasons, checkouts and changes. */
const bounds = { files: 40, reasons: 3, units: 12, checkouts: 12, changes: 40, recorded: 30 };

const none: SourceHistory = { branches: [], revisions: [], truncated: false };

/**
 * The activity of the repository a checkout belongs to. Live, it is read from Git, the checkouts
 * and the agents of that repository when asked. Recorded, it is assembled from what a history
 * build has read already, so the index carries it and a viewer needs neither Git nor a checkout.
 */
export class ProjectActivityService {
	private readonly work: ProjectWorkRepository;

	constructor(private readonly root: string) {
		this.work = new ProjectWorkRepository(root);
	}

	async show(limit: number): Promise<{ activity: ProjectActivity; live: LiveActivity }> {
		const checkouts = await this.work.checkouts();
		const own = checkouts.find((checkout) => checkout.path === this.root) ?? checkouts[0];
		const history = own.head ? await new SourceHistoryRepository(this.root).read(limit) : none;
		const notes = own.head ? await new HistoryStatusService(this.root).all() : new Map();
		const changes = await this.work.changes(history.revisions.map((item) => item.commit));
		const owners = unitOwners(await this.units());
		const activity = projectActivity({
			kind: 'live',
			repository: { name: basename(checkouts[0].path), branch: own.branch, head: own.head },
			revisions: history.revisions,
			reasons: (commit) => noted(notes.get(commit)),
			changes: (commit) => changes.get(commit) ?? [],
			owners,
			loops: await this.work.loops(),
			limit: { ...bounds, work: limit }
		});
		// The checkout this was asked in comes first: its changes are the ones looked for.
		const others = checkouts.filter((checkout) => checkout !== own);
		const shown = [own, ...others].slice(0, bounds.checkouts);
		const live = {
			sampledAt: new Date().toISOString(),
			worktrees: await Promise.all(shown.map((checkout) => this.worktree(checkout, owners))),
			agents: await new AgentActivityService(this.root, checkouts).roster()
		};
		return { activity, live };
	}

	/** The activity a history index records, from the revisions it has built. */
	async recorded(
		history: SourceHistory,
		details: ReadonlyMap<string, RecordedDetail>
	): Promise<ProjectActivity> {
		const [newest] = history.revisions;
		const registry = newest ? details.get(newest.commit)?.registry?.units : undefined;
		const owned = (registry ?? []).map((unit) => ({ id: unit.id, source: unit.owns.source }));
		const [primary] = await this.work.checkouts();
		const head = newest?.commit ?? null;
		const branch = history.branches.find((item) => item.head === head)?.name ?? null;
		return projectActivity({
			kind: 'recorded',
			repository: { name: basename(primary.path), branch, head },
			revisions: history.revisions,
			reasons: (commit) => details.get(commit)?.explanations ?? [],
			changes: (commit) => details.get(commit)?.sourceImpact?.changed ?? [],
			owners: unitOwners(owned),
			loops: newest ? await this.work.loops(newest.commit) : [],
			limit: { ...bounds, work: bounds.recorded }
		});
	}

	private async worktree(checkout: Checkout, owners: Owners): Promise<WorktreeState> {
		const { changes, truncated } = await this.work.uncommitted(checkout.path, bounds.changes);
		const { branch, head, primary } = checkout;
		const owned = changes.map((change: PathChange) => ({ ...change, units: owners(change.path) }));
		return { name: basename(checkout.path), branch, head, primary, changes: owned, truncated };
	}

	/** What each unit of the registry in this checkout says it owns; a damaged manifest owns nothing. */
	private async units(): Promise<OwnedSource[]> {
		const directory = join(this.root, 'specification', 'units');
		const names = existsSync(directory) ? await readdir(directory) : [];
		const read = names.map(async (name) => {
			try {
				const manifest = JSON.parse(await readFile(join(directory, name), 'utf8')) as {
					id: string;
					owns: { source: string[] };
				};
				return [{ id: manifest.id, source: manifest.owns.source }];
			} catch {
				return [];
			}
		});
		return (await Promise.all(read)).flat();
	}
}

/** The reasons noted on a commit, as the notes of the repository hold them. */
function noted(note: { entries: Array<{ kind: string }> } | undefined) {
	const entries = (note?.entries ?? []) as Array<Reason | { kind: string }>;
	return entries.flatMap((entry) =>
		entry.kind === 'reason' ? [(entry as Reason).explanation] : []
	);
}
