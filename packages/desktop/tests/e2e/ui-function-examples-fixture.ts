import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import scenario from '../../../../specification/scenarios/desktop-renderer.json' with { type: 'json' };
import { buildStamp } from '../../../../src/utils/buildStamp';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/record-capture/recordCapture';
import { commits, ids } from './ui-evidence-fixture';

/**
 * Gives the function of the synthetic project an earlier design version that holds an image, as
 * a plan made before functions stopped taking images does, and keeps every image the page asks
 * the backend for. The existing fixture is not changed: its answers are added to as they pass.
 */
function install(data: { id: string; planned: object; version: object }) {
	type Bridge = Record<string, (input?: object) => Promise<unknown>>;
	type Entity = Record<string, unknown> & { id: string };
	const asked: string[] = [];
	const { planned, version } = data;
	const listed = (entity: Entity) => (entity.id === data.id ? { ...entity, ...planned } : entity);
	type Snapshot = { entities: Entity[] };
	const shown = (snapshot: Snapshot) => ({ ...snapshot, entities: snapshot.entities.map(listed) });
	/** What each answer of the backend becomes on its way to the page; any other passes as it is. */
	const changed: Record<string, (answer: unknown, input?: object) => unknown> = {
		openProject: (answer) => shown(answer as Snapshot),
		snapshot: (answer) => shown(answer as Snapshot),
		selectProject: (answer) => shown(answer as Snapshot),
		entity: (answer) => {
			const detail = answer as Entity;
			return detail.id === data.id ? { ...detail, ...planned, versions: [version] } : detail;
		},
		image: (answer, input) => {
			asked.push((input as { entityId: string }).entityId);
			return answer;
		}
	};
	/** The bridge is filled in after it is set, so its methods are wrapped as they are read. */
	const wrapped = (bridge: Bridge) =>
		new Proxy(bridge, {
			get(target, name: string) {
				const method = target[name];
				const change = changed[name];
				if (!change || typeof method !== 'function') return method;
				return async (input?: object) => change(await method.call(target, input), input);
			}
		});
	const present = (window as unknown as { harness?: Bridge }).harness;
	let held = present ? wrapped(present) : undefined;
	Object.defineProperty(window, 'harness', {
		configurable: true,
		get: () => held,
		set: (value: Bridge) => (held = wrapped(value))
	});
	Object.assign(window, { __imagesAsked: asked });
}

export async function earlierDesign(page: Page): Promise<void> {
	const thumbnail = {
		version: 'v001',
		sha256: 'c'.repeat(64),
		state: 'default',
		viewport: 'desktop'
	};
	const version = {
		version: 'v001',
		createdAt: '2026-10-08',
		commit: commits.first,
		generator: 'GPT Image',
		prompt: 'Filter orders',
		notes: 'Returns the orders whose name contains the search, whatever its case.',
		baseRevision: commits.first,
		images: [{ state: 'default', viewport: 'desktop', sha256: 'c'.repeat(64) }],
		approval: null
	};
	const planned = { hasPlan: true, latestVersion: 'v001', thumbnail };
	await page.addInitScript(install, { id: ids.filter, planned, version });
}

/** The entities whose images the page asked the backend for since it loaded. */
export const imagesAsked = (page: Page) =>
	page.evaluate(() => (window as unknown as { __imagesAsked: string[] }).__imagesAsked);

const surfaces: Record<string, string> = {
	'function-card': 'function-card',
	'function-former-designs-address': 'function-plan-legacy',
	'function-rows': 'function-results-current',
	'function-commit': 'function-results-commit',
	'function-rows-tablet': 'function-results-current',
	'function-rows-mobile': 'function-results-current'
};

/** Required screenshots come from the running compiled renderer, over synthetic history. */
async function recorded(page: Page, name: string): Promise<void> {
	if (!evidenceRequested()) return;
	const state = surfaces[name];
	if (!state) throw new Error(`No function capture state for ${name}`);
	if (state.startsWith('function-results-')) {
		await page
			.getByRole('region', { name: 'Recorded runtime evidence' })
			.getByRole('table')
			.first()
			.waitFor();
		await page
			.getByText('Reading what it holds…', { exact: true })
			.first()
			.waitFor({ state: 'hidden' });
	}
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	const buildId = buildStamp(
		(await page.locator('meta[name="harness-build"]').getAttribute('content')) ?? undefined
	);
	const revision = process.env.HARNESS_VERIFY_REVISION ?? '';
	if (!buildId || process.env.HARNESS_VERIFY !== '1' || !/^[a-f0-9]{40}$/.test(revision))
		throw new Error('Function evidence requires a stamped build and verification revision');
	const size = page.viewportSize();
	const viewport = scenario.viewports.find(
		(item) => item.width === size?.width && item.height === size.height
	)?.id;
	const evidence = scenario.evidence.find(
		(item) => item.id === `function-screens-${viewport}` && item.states.includes(state)
	);
	if (!viewport || !evidence)
		throw new Error(`Undeclared function capture ${state} at ${viewport}`);
	await page.mouse.move(0, 0);
	recordCapture(
		{
			evidence: evidence.id,
			kind: 'screenshot',
			state,
			viewport,
			file: `ui-${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId, revision },
			note: 'Actual compiled function UI over SYNTHETIC history. Invocation examples are recorded separately from real composeModes calls.'
		},
		await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
	);
}

/**
 * The opt-in picture of a run, whole page, taken once fonts and images are ready and before what
 * it shows is judged. SCREENSHOT_LABEL names the phase and FUNCTION_EXAMPLES_SHOTS the folder.
 */
export async function pictured(page: Page, info: TestInfo, name: string): Promise<void> {
	await recorded(page, name);
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	const folder = process.env.FUNCTION_EXAMPLES_SHOTS ?? info.outputDir;
	const file = `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}.png`;
	await page.screenshot({ path: join(folder, file), fullPage: true, animations: 'disabled' });
}
