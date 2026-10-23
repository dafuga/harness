import type {
	Settings,
	Host,
	EvidenceState,
	Reads,
	EvidenceOptions
} from './ui-evidence-fixture.types';
import type { Locator, Page } from '@playwright/test';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import type { UnitDocumentation } from '../../../../src/utils/unit-documentation/unitDocumentation';
import type { ComponentManifest } from '../../../../src/lib/contracts';
import type {
	EntityEvidenceQuery,
	EvidenceArtifactQuery
} from '../../src/models/DesktopEvidence.types';
import { commits, evidenceData, ids, soundScenario, type EvidenceData } from './ui-evidence-data';
export * from './ui-evidence-data';
function installState(settings: Settings) {
	const urls = { made: [] as string[], revoked: [] as string[] };
	const objects = new Map<string, Blob | MediaSource>();
	const [make, revoke] = [URL.createObjectURL.bind(URL), URL.revokeObjectURL.bind(URL)];
	URL.createObjectURL = (value: Blob | MediaSource) => {
		const made = make(value);
		urls.made.push(made);
		objects.set(made, value);
		return made;
	};
	URL.revokeObjectURL = (value: string) => {
		urls.revoked.push(value);
		objects.delete(value);
		revoke(value);
	};
	const state = { calls: [], ...settings, held: settings.hold ? [] : null, urls, objects };
	Object.assign(window, { __evidence: { ...state, cache: () => {} }, harness: {} });
}
/** The reads every backend has: one project at a branch tip or at one of its commits. */
function installProject(data: EvidenceData) {
	const host = window as unknown as Host;
	const state = host.__evidence;
	const shared = { comments: true, agents: false, planning: false, approval: false };
	const snapshot = (commit: string | null = null) => ({
		project: { name: data.project.name, root: '/tmp/orders', id: data.project.id },
		capabilities: data.shared
			? { ...shared, source: 'github' }
			: { comments: true, agents: true, planning: true, approval: true, source: 'local' },
		...(data.shared
			? { cache: { identity: data.identity, status: 'fresh', publication: 'remote' } }
			: {}),
		revision: {
			branch: data.branch,
			commit: commit || data.tip,
			tip: data.tip,
			atTip: !commit || commit === data.tip
		},
		branches: [{ name: data.branch, tip: data.tip, current: true }],
		commits: data.commits,
		entities: data.catalog,
		writable: !commit && !data.shared
	});
	const kind = data.shared ? 'shared' : 'local';
	Object.assign(host.harness, {
		listProjects: async () => [{ ...data.project, kind }],
		selectProject: async () => snapshot(),
		openProject: async () => snapshot(),
		snapshot: async (input: { commit: string | null }) => snapshot(input.commit),
		entity: async (input: { entityId: string }) => {
			const found = data.entities.find((item) => item.id === input.entityId);
			if (!found) throw new Error('Unknown entity.');
			return found;
		},
		image: async () => new Uint8Array(data.design),
		source: async (input: { path: string }) => ({ path: input.path, text: 'export {};' }),
		messages: async () => [],
		providers: async () => [],
		onRunEvent: () => () => {},
		onCacheStatus: (listener: EvidenceState['cache']) => {
			state.cache = listener;
			return () => {};
		}
	});
}

/** The two evidence reads, typed as the bridge states them and bound as a backend binds them. */
function installEvidence(data: EvidenceData) {
	const host = window as unknown as Host;
	const state = host.__evidence;
	const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
	const reads: Reads = {
		evidence: async (input: EntityEvidenceQuery) => {
			state.calls.push({ op: 'evidence', ...input });
			const key = `${input.entityId}|${input.mode}|${input.commit}`;
			await wait(state.delay[key] ?? 0);
			const found = data.results[key];
			if (!found || input.branch !== data.branch)
				throw new Error('No recorded evidence is bound to this address.');
			return found;
		},
		artifact: async (input: EvidenceArtifactQuery) => {
			state.calls.push({ op: 'artifact', ...input });
			if (state.held) await new Promise<void>((release) => state.held?.push(release));
			if (state.moved) throw new Error('The pinned evidence changed; read the entity again.');
			const key = data.bindingFields.map((name) => input[name] ?? '').join('|');
			const sha256 = data.bindings[key];
			const kept = sha256 ? data.bytes[sha256] : undefined;
			if (!kept) throw new Error('This capture is not part of the selected record.');
			const bytes = new Uint8Array(kept.data);
			if (state.corrupt.includes(sha256)) bytes[bytes.length - 1] ^= 1;
			return { bytes, mediaType: kept.mediaType, sha256 };
		}
	};
	Object.assign(host.harness, reads);
}

/** A backend from before the two reads existed: it has neither of them. */
function removeEvidence() {
	const { harness } = window as unknown as Host;
	delete harness.evidence;
	delete harness.artifact;
}

export async function evidenceFixture(page: Page, options: EvidenceOptions = {}) {
	const data = evidenceData(options.shared, options.observedUnits, options.example, {
		browserErrors: options.browserErrors,
		inheritedOnly: options.inheritedOnly
	});
	for (const entity of data.entities) {
		entity.documentation = options.documentation?.[entity.id];
		const preview = options.previews?.[entity.id];
		if (preview) entity.thumbnail = { source: 'recorded', ...preview };
	}
	const { delay = {}, corrupt = [], moved = false, hold = false } = options;
	await page.addInitScript(installState, { delay, corrupt, moved, hold });
	// Serialize the recursive documentation graph without Playwright's recursive handle type.
	await page.addInitScript({ content: `(${installProject.toString()})(${JSON.stringify(data)})` });
	await page.addInitScript({ content: `(${installEvidence.toString()})(${JSON.stringify(data)})` });
	if (options.reads === false) await page.addInitScript(removeEvidence);
	return data;
}

/** What the synthetic backend was asked and what the page did with object URLs. */
export const evidenceState = (page: Page) =>
	page.evaluate(() => {
		const { calls, urls } = (window as unknown as Host).__evidence;
		return { calls, urls };
	});

/** Gives the bytes that were held back, and holds none from now on. */
export const evidenceRelease = (page: Page) =>
	page.evaluate(() => {
		const state = (window as unknown as Host).__evidence;
		const waiting = state.held ?? [];
		state.held = null;
		for (const release of waiting) release();
	});

/** What the cache channel of a backend says about the shown project. */
export const evidenceCache = (page: Page, event: Parameters<EvidenceState['cache']>[0]) =>
	page.evaluate((value) => (window as unknown as Host).__evidence.cache(value), event);

/**
 * The bytes of the object behind what a media element plays, read from that object itself: the
 * renderer's policy lets an object URL be played and not fetched, and a capture needs no more.
 */
export const evidencePlayed = (media: Locator) =>
	media.evaluate(async (node: HTMLMediaElement) => {
		if (!Number.isFinite(node.duration) || node.duration <= 0)
			throw new Error('Fixture audio is not playable');
		const made = (window as unknown as Host).__evidence.objects.get(node.currentSrc);
		if (!(made instanceof Blob)) throw new Error('The page made no object for what it plays');
		return [...new Uint8Array(await made.arrayBuffer())];
	});

/** The SHA-256 the sealed history states for the one clip of the search box at the branch tip. */
export function recordedClip(data: EvidenceData = evidenceData()): string {
	const { evidence } = data.results[`${ids.search}|current|${commits.tip}`];
	const clips = (evidence.after?.captures ?? []).filter(
		(found) => found.scenario === soundScenario
	);
	if (clips.length !== 1) throw new Error('The sealed history does not keep exactly one such clip');
	return clips[0].capture.sha256;
}

export type { EvidenceState, EvidenceOptions } from './ui-evidence-fixture.types';
