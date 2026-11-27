import { readFileSync } from 'node:fs';
import type { HomePlan } from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import type { Page } from '@playwright/test';
import { expect } from '../../../../test/support/browserTest';
import {
	hostedFixture,
	ada,
	atlas,
	hostedData,
	disableCollaboration,
	waitForHubStatus
} from './hosted-fixture';
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

async function planArtifacts(page: Page, plan?: HomePlan) {
	if (plan)
		Object.assign(plan, {
			stage: 'design',
			planning: {
				promotions: [],
				artifacts: {
					design: {
						summary: 'Approved designs for the dashboard.',
						pages: [
							{
								name: 'Dashboard',
								states: { ready: 'Shows the latest plan activity.' },
								links: [
									{
										kind: 'image',
										label: 'Dashboard mockup',
										url: 'https://design.example.test/dashboard.png'
									},
									{
										kind: 'link',
										label: 'Dashboard design canvas',
										url: 'https://design.example.test/canvas'
									}
								]
							}
						]
					}
				}
			}
		});
	await page.route('https://design.example.test/dashboard.png', (route) =>
		route.fulfill({
			contentType: 'image/png',
			body: readFileSync(new URL('../../static/icons/harness-512.png', import.meta.url))
		})
	);
}

export async function hubHomeFixture(page: Page, mode: HomeFixtureState) {
	const state = await hostedFixture(page, { actor: { ...ada, name: 'Daniel' } });
	await page.route(/\/api\/remote\/hosts\?linked=1$/, (route) =>
		route.fulfill({ json: { computers: [] } })
	);
	await page.route('**/downloads/Harness-mac-arm64.zip', (route) =>
		route.fulfill({ status: 200, contentType: 'text/html', body: '' })
	);
	await page.clock.setFixedTime(homeClock);
	const data = mockup(mode);
	const snapshot = homeData(data);
	await planArtifacts(page, snapshot.plans[0]);
	if (mode === 'busy')
		snapshot.providers.routinesReadAt = new Date(homeClock - 10_800_000).toISOString();
	if (mode === 'empty') snapshot.providers.quota = null;
	let release = () => {};
	let released = false;
	const pending = new Promise<void>((resolve) => {
		release = () => {
			released = true;
			resolve();
		};
	});
	const sent: unknown[] = [];
	const controlled = new Set<string>();
	await page.route('**/api/hub-home/agents', async (route) => {
		const { id } = route.request().postDataJSON() as { id: string };
		if (route.request().method() === 'POST') controlled.add(id);
		else controlled.delete(id);
		await route.fulfill({ json: { controlled: [...controlled] } });
	});
	await projectFixture(page, data.projects, mode === 'loading' ? pending : undefined);
	await page.route('**/api/hub-home', async (route) => {
		if (mode === 'loading') await pending;
		const granted = state.signedIn && state.actor.id === ada.id;
		const hasSnapshot = granted && (mode !== 'unavailable' || released);
		await route.fulfill({
			json: { granted, snapshot: hasSnapshot ? snapshot : null, controlled: [...controlled] }
		});
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

export async function unavailableHome(
	{
		page,
		baseURL,
		browserErrors
	}: {
		page: Page;
		baseURL?: string;
		browserErrors: Parameters<typeof disableCollaboration>[1];
	},
	fixture: Awaited<ReturnType<typeof hubHomeFixture>>,
	capture: (screen: string) => Promise<void>
) {
	await disableCollaboration(page, browserErrors, baseURL!);
	await Promise.all([
		waitForHubStatus(page, '/api/projects', 503),
		waitForHubStatus(page, '/api/hub-home', 200),
		page.goto('/')
	]);
	const projects = page.getByRole('region', { name: 'Projects', exact: true });
	await expect(projects).toBeVisible();
	await fit(page, page.viewportSize()!.width);
	await capture('root');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connect your Mac');
	await expect(page.getByRole('status').filter({ hasText: 'same Google account' })).toBeVisible();
	await expect(projects.getByText('Loading projects…')).toHaveCount(0);
	await projects.getByRole('button', { name: 'See all projects' }).click();
	const dialog = page.getByRole('dialog', { name: 'Projects', exact: true });
	await expect(dialog.getByText('Loading projects…')).toHaveCount(0);
	await capture('projects');
	fixture.release();
	await disableCollaboration(page, browserErrors, baseURL!);
	await dialog.getByRole('button', { name: 'Try again' }).click();
	if (fixture.snapshot.overview.status !== 'ready')
		throw new Error('Expected a ready Tracker fixture');
	const name = fixture.snapshot.overview.projects[0].agent;
	await expect(dialog.getByRole('heading', { name, exact: true })).toBeVisible();
	await expect(dialog.getByRole('link', { name: 'Open Project Overview' })).toHaveAttribute(
		'href',
		'/tracker-overview'
	);
	await capture('projects-recovered');
	await page.keyboard.press('Escape');
	await expect(projects.getByText(name, { exact: true })).toBeVisible();
	await capture('tracker-projects');
}

export async function fit(page: Page, width: number) {
	const bounds = await page.evaluate(() => ({
		width: document.documentElement.scrollWidth,
		columns: getComputedStyle(document.querySelector('.hh-grid')!).gridTemplateColumns.split(' ')
			.length
	}));
	expect(bounds.width).toBeLessThanOrEqual(width);
	expect(bounds.columns).toBe(width === 390 ? 1 : width === 834 ? 2 : width === 1440 ? 3 : 4);
}

export const needsYouSizes = {
	desktop: { width: 1440, height: 900 },
	tablet: { width: 820, height: 1180 },
	phone: { width: 390, height: 844 }
};

export async function needsYouHome(
	page: Page,
	size: keyof typeof needsYouSizes,
	change: 'two-asks' | 'no-choices'
) {
	await page.setViewportSize(needsYouSizes[size]);
	await page.emulateMedia({
		colorScheme: size === 'tablet' ? 'light' : 'dark',
		reducedMotion: 'reduce'
	});
	const fixture = await hubHomeFixture(page, 'default');
	const [chief] = fixture.snapshot.agents;
	if (change === 'two-asks')
		fixture.snapshot.agents.push({
			...chief,
			id: 'harbor',
			name: 'harbor',
			itemId: 'item-harbor',
			question: 'Ship harbor?',
			confirm: undefined,
			messages: [],
			options: [
				{ label: 'Ship harbor now', effect: 'Merges and releases.', recommended: true },
				{ label: 'Hold harbor', effect: 'Waits a day.' }
			]
		});
	else
		for (const agent of fixture.snapshot.agents) {
			delete agent.options;
			delete agent.confirm;
		}
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Agents', exact: true })).toBeVisible();
	return fixture;
}
