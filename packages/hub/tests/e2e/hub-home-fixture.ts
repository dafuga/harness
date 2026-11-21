import type { Page } from '@playwright/test';
import { hostedFixture, ada, atlas, hostedData } from './hosted-fixture';
import { homeClock, homeData, mockup } from './hub-home-fixture-data';
import type { FixtureProject, HomeFixtureState } from './hub-home-fixture.types';

function projectId(index: number) {
	return index === 0 ? atlas : `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

async function projectFixture(page: Page, projects: FixtureProject[], held?: Promise<void>) {
	const source = hostedData().projects[0];
	await page.route('**/api/projects', async (route) => {
		await held;
		return route.fulfill({
			json: projects.map((project, index) => ({
				...source,
				id: projectId(index),
				name: project.name,
				sourceRepository: {
					...source.sourceRepository,
					name: project.name.toLowerCase().replaceAll(' ', '-')
				}
			}))
		});
	});
	await page.route('**/api/projects/*/snapshot', (route) => {
		const project = projects.find((_, index) => route.request().url().includes(projectId(index)));
		if (!project) return route.fulfill({ json: { commits: [], entities: [] } });
		const entities = [
			...Array.from({ length: project.pages }, (_, index) => ({
				id: `${index % project.apps === 0 ? 'hub' : `app-${index % project.apps}`}.page.${index}`,
				category: 'pages',
				title: ['Home', 'Projects', 'Project overview'][index] ?? `Page ${index + 1}`
			})),
			...Array.from({ length: project.components }, (_, index) => ({
				id: `${index % project.apps === 0 ? 'hub' : `app-${index % project.apps}`}.component.${index}`,
				category: 'components',
				title: ['AgentCard', 'PlanCard', 'QuotaBar'][index] ?? `Component ${index + 1}`
			}))
		];
		const commits = [
			{
				hash: project.hash.padEnd(40, '0'),
				subject: project.change,
				authoredAt: new Date(homeClock - 3600000).toISOString()
			}
		];
		return route.fulfill({ json: { project: { name: project.name }, entities, commits } });
	});
}

export async function hubHomeFixture(page: Page, mode: HomeFixtureState) {
	const state = await hostedFixture(page, { actor: { ...ada, name: 'Daniel' } });
	await page.route('**/downloads/Harness-mac-arm64.zip', (route) =>
		route.fulfill({ status: 200, contentType: 'text/html', body: '' })
	);
	await page.clock.setFixedTime(homeClock);
	const data = mockup(mode);
	const snapshot = homeData(data);
	let release = () => {};
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	const sent: unknown[] = [];
	await projectFixture(page, data.projects, mode === 'loading' ? pending : undefined);
	await page.route('**/api/hub-home', async (route) => {
		if (mode === 'loading') await pending;
		const granted = state.signedIn && state.actor.id === ada.id;
		await route.fulfill({ json: { granted, snapshot: granted ? snapshot : null } });
	});
	await page.route(/\/api\/hub-home\/chat(?:\?|$)/, async (route) => {
		if (route.request().method() === 'POST') {
			const message = route.request().postDataJSON();
			sent.push(message);
			return route.fulfill({ status: 202, json: { id: message.id, status: 'queued' } });
		}
		const id = new URL(route.request().url()).searchParams.get('id');
		return route.fulfill({ json: { id, status: 'sent' } });
	});
	return { release, sent, state, snapshot };
}
