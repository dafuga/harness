import type { Page } from '@playwright/test';
import { projectFixture } from './ui-project-fixture';

type Item = Record<string, unknown>;
const thread = {
	id: '44444444-4444-4444-8444-444444444444',
	pin: 1,
	version: null,
	imageSha256: null,
	state: null,
	viewport: null,
	region: null,
	messageCount: 1
};
const created = {
	category: 'functions',
	entityId: 'function.format-time',
	threadId: thread.id,
	requestSaved: true
};

/** The synthetic result is prepared in the test process, outside the browser initializer. */
function completion(seed: Item, input: Item) {
	return {
		entity: {
			...seed,
			id: created.entityId,
			category: 'functions',
			kind: 'function',
			title: 'Format elapsed time',
			summary: 'Readable elapsed milliseconds',
			latestVersion: null,
			thumbnail: null,
			versions: [],
			threads: [thread],
			history: [],
			sources: []
		},
		messages: [
			{
				id: 'original-request',
				at: '2026-10-13T18:00:00Z',
				author: 'user',
				text: input.text,
				mode: 'plan',
				provider: input.provider,
				model: input.model,
				version: null,
				imageSha256: null
			}
		],
		event: {
			runId: 'creation-run',
			kind: 'finished',
			summary: 'Synthetic plan saved for review',
			verified: false,
			created
		}
	};
}

function installCreation() {
	const host = window as unknown as {
		harness: Record<string, unknown>;
		__creation(seed: Item, input: Item): Promise<ReturnType<typeof completion>>;
		__projects: {
			own(op: string, input: Item): { entities: Item[]; messages: Record<string, Item[]> };
		};
	};
	let follow: (event: Item) => void = () => {};
	host.harness.onRunEvent = (listener: typeof follow) => {
		follow = listener;
		return () => {};
	};
	host.harness.startRun = async (input: Item) => {
		const project = host.__projects.own('startRun', input);
		setTimeout(async () => {
			const made = await host.__creation(project.entities[0], input);
			project.entities.push(made.entity);
			project.messages[made.event.created.threadId] = made.messages;
			follow(made.event);
		}, 40);
		return { runId: 'creation-run' };
	};
}

/** Synthetic finished request over the real shared shell; the backend is tested separately. */
export async function creationFixture(page: Page) {
	await projectFixture(page);
	await page.exposeFunction('__creation', completion);
	await page.goto('/');
	await page.evaluate(installCreation);
	await page.getByRole('button', { name: 'Open Alpha', exact: true }).click();
}
