import { createWorkspaceStore } from '../../../../../desktop/src/lib/stores/workspace.svelte';
import { createEntityEvidenceStore } from '../../../../../desktop/src/lib/stores/entityEvidence.svelte';
import { entityBehavior } from '../../../../src/utils/entityBehavior';
import { galleryItems, screenOptions } from '../../../../src/utils/entityScreens';
import type { DesktopBridge } from '../../../../../desktop/src/models/DesktopBridge.types';
import type { EntityDetail } from '../../../../../desktop/src/models/Desktop.types';
import { ids, commits } from './explorerData';
import { stamp } from './shared';
import { desktopData } from './sealedData';
import { deploymentBridge } from './deployments';
export const providers = [
	{
		id: 'codex',
		label: 'Codex',
		available: true,
		reason: null,
		version: 'fixture',
		imageGeneration: true,
		models: [
			{
				id: 'preview-model',
				label: 'Preview model',
				efforts: ['high', 'xhigh'],
				defaultEffort: 'high',
				isDefault: true
			}
		]
	}
];
const message = {
	id: 'preview-message',
	at: stamp,
	author: 'user',
	text: 'Review the component states.',
	mode: null,
	provider: null,
	model: null,
	version: null,
	imageSha256: null
};
const hosted = {
	configured: true,
	state: 'signed-in',
	actor: { id: 'preview-person', name: 'Ada Example', email: 'ada@example.invalid' },
	handoff: null
};
export function createDesktopData(id: string) {
	const workspace = createWorkspaceStore();
	const entity = desktopData.entities.find((e) => e.id === ids.page)! as unknown as EntityDetail;
	const bridge = desktopBridge(entity);
	configureWorkspace(workspace, entity, bridge, id);
	const visualEntity = desktopData.entities.find(
		(e) => e.id === ids.card
	)! as unknown as EntityDetail;
	const filterEntity = desktopData.entities.find(
		(e) => e.id === ids.filter
	)! as unknown as EntityDetail;
	const result = desktopData.results[`${ids.filter}|current|${commits.tip}`];
	const visual = desktopData.results[`${ids.card}|current|${commits.tip}`];
	const evidence = evidenceOf(ids.filter, bridge);
	const visualEvidence = evidenceOf(ids.card, bridge);
	const audioEvidence = evidenceOf(ids.search, bridge);
	const audioResult = desktopData.results[`${ids.search}|current|${commits.tip}`];
	return {
		workspace,
		ready: Promise.all([whenReady(evidence), whenReady(visualEvidence), whenReady(audioEvidence)]),
		visualEntity,
		filterEntity,
		entity,
		result,
		visual,
		evidence,
		visualEvidence,
		audioResult,
		audioEvidence,
		shown: entityBehavior(result.behavior),
		cell: entityBehavior(result.behavior).groups[0].lines[0].after,
		options: screenOptions(visual.evidence.scenarios),
		item: galleryItems(visual.evidence).find((item) => item.phase !== 'before')!,
		design: entity.versions[0],
		thread: {
			id: 'preview-thread',
			pin: 1,
			version: 'v001',
			imageSha256: null,
			state: null,
			viewport: null,
			region: null,
			messageCount: 1
		},
		message,
		cleanup: () => {
			evidence.reset();
			visualEvidence.reset();
			audioEvidence.reset();
		}
	};
}
function desktopBridge(entity: EntityDetail): DesktopBridge {
	return {
		...deploymentBridge,
		providers: async () => providers,
		onRunEvent: () => () => {},
		onCacheStatus: () => () => {},
		projects: async () => [
			{ id: desktopData.project.id, name: 'Preview project', source: 'local' }
		],
		image: async () => new Uint8Array(desktopData.design),
		entity: async () => entity,
		messages: async () => [message],
		comments: async () => [],
		projectMessages: async () => [],
		source: async () => ({ text: 'export const preview = true;' }),
		hostedStatus: async () => hosted,
		connectHosted: async () => hosted,
		disconnectHosted: async () => ({ ...hosted, state: 'signed-out' }),
		evidence: async (input: Parameters<NonNullable<DesktopBridge['evidence']>>[0]) =>
			desktopData.results[`${input.entityId}|${input.mode}|${input.commit}`],
		artifact: async (input: Parameters<NonNullable<DesktopBridge['artifact']>>[0]) => {
			const key = desktopData.bindingFields
				.map((name) => input[name as keyof typeof input] ?? '')
				.join('|');
			const sha256 = desktopData.bindings[key];
			const kept = desktopData.bytes[sha256];
			if (!kept) throw new Error('Preview artifact is not bound to the selected result.');
			return { bytes: new Uint8Array(kept.data), mediaType: kept.mediaType, sha256 };
		}
	} as unknown as DesktopBridge;
}
export type DesktopData = ReturnType<typeof createDesktopData>;
export type DesktopCase = (data: DesktopData) => Record<string, unknown>;

function configureWorkspace(
	workspace: ReturnType<typeof createWorkspaceStore>,
	entity: EntityDetail,
	bridge: DesktopBridge,
	id: string
) {
	workspace.bridge = bridge;
	workspace.snapshot = {
		project: { ...desktopData.project, root: '/preview' },
		revision: { branch: desktopData.branch, commit: commits.tip, tip: commits.tip, atTip: true },
		branches: [{ name: desktopData.branch, tip: commits.tip, current: true }],
		commits: desktopData.commits,
		entities: desktopData.entities as unknown as EntityDetail[],
		writable: true
	};
	workspace.projects = [
		{ id: desktopData.project.id, name: 'Preview project', kind: 'local', root: '/preview' }
	];
	workspace.capabilities = {
		agents: true,
		comments: true,
		planning: true,
		approval: true,
		source: 'local'
	};
	workspace.category = 'components';
	workspace.entity = id === 'desktop.component.entity-view' ? entity : null;
}

function evidenceOf(entityId: string, bridge: DesktopBridge) {
	const evidence = createEntityEvidenceStore();
	evidence.show(bridge, {
		scope: {
			entityId,
			commit: commits.tip,
			branch: desktopData.branch,
			mode: 'current',
			projectId: desktopData.project.id
		},
		planned: false,
		stamp: 'preview'
	});
	return evidence;
}

async function whenReady(store: ReturnType<typeof createEntityEvidenceStore>) {
	for (let attempt = 0; attempt < 100; attempt++) {
		if (store.status === 'failed') throw new Error(store.error);
		if (
			store.status === 'ready' &&
			(store.result!.behavior.rows.length === 0 || store.read !== undefined)
		) {
			if (store.read === null) throw new Error('The preview evidence could not be read.');
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('The preview evidence did not become ready.');
}
