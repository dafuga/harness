import { nativeImageFixture } from '../../../desktop/tests/e2e/native-image-fixture';

/** Synthetic people and projects. Nothing here exists outside these tests. */
export const atlas = '6f1d2c3b-4a59-4e68-9f70-8a1b2c3d4e5f';
export const borealis = '7a2e3d4c-5b6a-4f79-8a81-9b2c3d4e5f60';
export const invitation = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
export const atlasThread = '33333333-3333-4333-8333-333333333333';
export const tip = 'a'.repeat(40);
export const earlier = 'c'.repeat(40);
export const imageSha = 'b'.repeat(64);
export const sharedCommit = 'f'.repeat(40);
export const code = 'fixture-one-time-code';
export const credential = 'fixture-google-credential';
export const clientId = 'fixture-client.apps.googleusercontent.com';
export const ada = {
	id: 'google:ada',
	email: 'ada@example.invalid',
	name: 'Ada Example',
	emailVerified: true
};
export const image = nativeImageFixture();

function summary(id: string, name: string, role: string) {
	const sourceRepository = { id: 42, owner: 'acme', name: name.toLowerCase(), private: true };
	return {
		id,
		name,
		role,
		sourceRepository,
		createdAt: '2026-10-01T00:00:00.000Z',
		ownerId: ada.id
	};
}

function entity(name: string, designed: boolean) {
	const version = designed ? 'v001' : null;
	const images = [{ state: 'default', viewport: 'desktop', sha256: imageSha, bytes: image.length }];
	const design = {
		version: 'v001',
		createdAt: '2026-10-11',
		commit: tip,
		generator: 'GPT Image',
		prompt: 'Activity page',
		baseRevision: tip,
		images,
		approval: null
	};
	return {
		id: 'page.activity',
		category: 'pages',
		kind: 'page',
		title: `${name} activity`,
		summary: `The activity page of ${name}.`,
		changed: false,
		planned: false,
		hasPlan: false,
		lifecycle: null,
		verification: 'unverified',
		verificationNote: 'No verification recorded for this revision.',
		latestVersion: version,
		approvedVersion: null,
		threadCount: 0,
		thumbnail: version
			? { version, sha256: imageSha, state: 'default', viewport: 'desktop' }
			: null,
		contract: { inputs: [], outputs: [], errors: [], hash: 'c'.repeat(64) },
		relationships: [],
		versions: designed ? [design] : [],
		threads: [],
		history: [],
		sources: [],
		size: { available: false, text: 'Not measured' },
		performance: { available: false, text: 'Not measured' }
	};
}

export const anchor = {
	branch: 'main',
	commit: tip,
	entityId: 'page.activity',
	version: 'v001',
	imageSha256: imageSha,
	state: 'default',
	viewport: 'desktop',
	region: { x: 0.1, y: 0.2, width: 0.3, height: 0.2 }
};

export function hostedData() {
	const said = {
		id: 'comment-1',
		requestId: 'request-1',
		actor: { ...ada, id: 'google:ben', name: 'Ben Example', email: 'ben@example.invalid' },
		text: 'Atlas: align the filters.',
		createdAt: '2026-10-11T09:00:00.000Z'
	};
	return {
		projects: [
			{ ...summary(atlas, 'Atlas', 'owner'), branch: 'main', entity: entity('Atlas', true) },
			{
				...summary(borealis, 'Borealis', 'viewer'),
				branch: 'trunk',
				entity: entity('Borealis', false)
			}
		],
		threads: {
			[atlas]: [{ id: atlasThread, projectId: atlas, anchor, comments: [said] }],
			[borealis]: []
		} as Record<string, Record<string, unknown>[]>,
		members: [
			{ projectId: atlas, actorId: ada.id, email: ada.email, name: ada.name, role: 'owner' },
			{
				projectId: atlas,
				actorId: 'google:ben',
				email: 'ben@example.invalid',
				name: 'Ben Example',
				role: 'commenter'
			}
		]
	};
}
export type HostedData = ReturnType<typeof hostedData>;
export type HostedProject = HostedData['projects'][number];
