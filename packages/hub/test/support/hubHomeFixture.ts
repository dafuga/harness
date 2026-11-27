import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { SESSION_COOKIE } from '../../src/utils/accounts-access/authCookies';
import { ORIGIN } from '../support/authFixture';
import { snapshot } from './trackerOverviewFixture';

export const migration = readFileSync(
	new URL('../../db/migrations/0005-hub-home-chat.sql', import.meta.url),
	'utf8'
);
export const url = ORIGIN + '/api/hub-home';
export const id = '548e9822-86b2-4b55-9a7f-beedac7525b8';
export const agent = {
	id: 'cos',
	name: 'Chief of Staff',
	state: 'needs-you',
	sessions: 0,
	tasks: [],
	subAgents: { sessions: 0, tasks: [] },
	itemId: 'item-1',
	task: 'Choose wording',
	machine: null,
	model: null,
	since: '2026-11-21T07:59:00.000Z',
	question: 'Choose the synthetic scope',
	messages: []
};
export const plan = {
	id: 'fixture-plan',
	title: 'Plan the fixture',
	project: null,
	state: 'draft',
	updatedAt: '2026-11-21T07:59:00.000Z',
	stage: 'design',
	total: 0,
	done: 0,
	steps: [],
	planning: {
		promotions: [],
		artifacts: {
			design: {
				summary: 'Fixture design',
				links: [{ kind: 'image', label: 'Mockup', url: 'https://design.example.test/plan.png' }]
			}
		}
	}
};
export const payload = {
	overview: snapshot(),
	agents: [agent],
	plans: [],
	scheduled: [],
	providers: { routines: [], quota: [] }
};
export const message = {
	id,
	agentId: agent.id,
	itemId: agent.itemId,
	kind: 'answer',
	text: 'Synthetic reply',
	question: agent.question
};

export function homeRequest(
	method: string,
	session: { cookie?: string; bearer?: string },
	path = '',
	body?: unknown
) {
	const headers = new Headers({ origin: ORIGIN, 'content-type': 'application/json' });
	if (session.cookie) headers.set('cookie', `${SESSION_COOKIE}=${session.cookie}`);
	if (session.bearer) headers.set('authorization', `Bearer ${session.bearer}`);
	return new Request(url + path, {
		method,
		headers,
		body: body === undefined ? null : JSON.stringify(body)
	});
}

export async function sheets(sql: string = migration) {
	const worker = new Miniflare({
		cf: false,
		workers: [
			{
				config: {
					name: 'hub-home-test',
					compatibilityDate: '2026-10-12',
					manifest: {
						mainModule: 'index.js',
						modules: {
							'index.js': {
								type: 'esm',
								contents: 'export default { fetch() { return new Response("ok"); } }'
							}
						}
					},
					env: { DB: { type: 'd1', name: 'hub-home-fixture' } }
				}
			}
		]
	});
	const db = (await worker.getD1Database('DB', 'hub-home-test')) as unknown as D1Database;
	for (const statement of sql
		.replace(/^--.*$/gm, '')
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean))
		await db.prepare(statement).run();
	return { db, close: () => worker.dispose() };
}
