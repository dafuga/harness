import type { Page } from '@playwright/test';
import { alphaThread, gammaThread, projectFixture } from './ui-project-fixture';
export * from './ui-project-fixture';

type Entity = Record<string, unknown>;
/** The agent's stored question: two registered units, one unknown id and one hostile reference. */
export const question =
	'Should [[unit:app.shell.order-frame]] call [[unit:app.function.format-time]]? Not [[unit:app.function.missing]] or [[unit:javascript:alert(1)]].';
/** A person's comment in the shared project that names one of its units. */
export const remark = 'The frame [[unit:app.shell.order-frame]] needs a wider gutter.';
const named = [
	{
		project: 0,
		id: 'app.function.format-time',
		category: 'functions',
		kind: 'function',
		title: 'Format time'
	},
	{
		project: 0,
		id: 'app.shell.order-frame',
		category: 'shells',
		kind: 'shell',
		title: 'Order frame'
	},
	{
		project: 2,
		id: 'app.shell.order-frame',
		category: 'shells',
		kind: 'shell',
		title: 'Gamma frame'
	}
];

interface Seed {
	named: typeof named;
	question: string;
	remark: string;
	threads: { alpha: string; gamma: string };
}

interface ReferenceHost {
	harness: Record<string, unknown>;
	__emitRun: (event: Record<string, unknown>) => void;
	__projects: {
		data: { projects: Array<{ entities: Entity[]; messages: Record<string, Entity[]> }> };
		own: (op: string, input: Entity) => unknown;
	};
}

function install(input: Seed) {
	const host = window as unknown as ReferenceHost;
	const { data } = host.__projects;
	for (const { project, ...unit } of input.named) {
		const base = data.projects[project].entities.find((entity) => entity.category === 'components');
		data.projects[project].entities.push({
			...base,
			...unit,
			summary: `${unit.title}.`,
			threads: [],
			versions: []
		});
	}
	const message = (id: string, author: string, text: string) => ({
		...{ id, at: 'Today', author, text, mode: 'plan', provider: 'codex', model: 'fixture' },
		...{ version: 'v002', imageSha256: 'b'.repeat(64) }
	});
	data.projects[0].messages[input.threads.alpha].push(
		message('agent-question', 'agent', input.question)
	);
	const gamma = data.projects[2];
	gamma.entities[0].threads = [
		{
			id: input.threads.gamma,
			pin: 1,
			version: 'v001',
			imageSha256: 'b'.repeat(64),
			state: 'default',
			viewport: 'desktop',
			region: { x: 0.1, y: 0.2, width: 0.3, height: 0.2 },
			messageCount: 1
		}
	];
	gamma.messages[input.threads.gamma] = [
		{ ...message('gamma-remark', 'user', input.remark), version: 'v001' }
	];
	// Runs answer only through the events a test sends; every listener hears each one.
	const listeners = new Set<(event: Entity) => void>();
	host.harness.onRunEvent = (listener: (event: Entity) => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	};
	host.harness.startRun = async (request: Entity) => {
		host.__projects.own('startRun', request);
		return { runId: 'reference-run' };
	};
	host.__emitRun = (event) => {
		for (const listener of listeners) listener({ runId: 'reference-run', ...event });
	};
}

/** The project fixture, local or hosted, whose agent and threads name registered units. */
export async function referenceFixture(page: Page, fixture = projectFixture) {
	await fixture(page);
	const threads = { alpha: alphaThread, gamma: gammaThread };
	await page.addInitScript(install, { named, question, remark, threads });
}

/** Sends one run event, as the main process would. */
export const emitRun = (page: Page, event: Record<string, unknown>) =>
	page.evaluate(
		(value) => (window as unknown as { __emitRun: (e: unknown) => void }).__emitRun(value),
		event
	);
