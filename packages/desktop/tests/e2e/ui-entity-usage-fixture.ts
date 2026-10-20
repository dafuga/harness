import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import scenarioData from '../../../../specification/scenarios/desktop-renderer.json' with { type: 'json' };
import { buildStamp } from '../../../../src/utils/buildStamp';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/record-capture/recordCapture';
import { ids } from './ui-evidence-fixture';

/**
 * What the catalog recorded around the function of the synthetic project: a page and a component
 * use it, and it uses a config, a service and a model. The entities of the existing fixture hold
 * no relationship; these are added to the answer for that one function and to nothing else.
 */
const link = (direction: string, id: string, title: string, category: string | null) => ({
	id,
	title,
	category,
	direction,
	hasPlan: false,
	verification: 'unverified'
});
const recorded = [
	link('used-by', ids.page, 'OrdersPage', 'pages'),
	link('used-by', ids.list, 'OrderList', 'components'),
	link('uses', ids.settings, 'orderSettings', 'configs'),
	link('uses', ids.store, 'OrderStore', 'services'),
	link('uses', 'app.model.order', 'Order', null)
];

/** Call once the page has loaded: the bridge is asked for an entity each time one is opened. */
export async function related(page: Page): Promise<void> {
	await page.evaluate(
		({ id, relationships }) => {
			type Entity = { id: string; relationships: unknown[] };
			const bridge = (window as unknown as { harness: { entity(input: object): Promise<Entity> } })
				.harness;
			const read = bridge.entity.bind(bridge);
			bridge.entity = async (input) => {
				const entity = await read(input);
				return entity.id === id ? { ...entity, relationships } : entity;
			};
		},
		{ id: ids.filter, relationships: recorded }
	);
}

const scenario: ScenarioManifest = scenarioData as ScenarioManifest;
const both = ['Used In', 'Uses'];
/** The scenario state each picture of a run stands for, and the sections it has to show first. */
const pictures: Record<string, { state: string; shown: string[] }> = {
	'workspace-overview': { state: 'usage-overview', shown: both },
	'workspace-overview-tablet': { state: 'usage-overview', shown: both },
	'workspace-overview-mobile': { state: 'usage-overview', shown: both },
	'workspace-used-in': { state: 'usage-used-in', shown: ['Used In'] },
	'workspace-uses': { state: 'usage-uses', shown: ['Uses'] },
	'workspace-former-address': { state: 'usage-former-address', shown: both },
	'workspace-nothing-recorded': { state: 'usage-nothing-recorded', shown: both }
};
const note =
	'Actual compiled renderer over a SYNTHETIC project: its orders, history and the relationships added to one function are fixtures. Only the build and revision identify tested software.';

/** The build the page was compiled as and the revision being verified, or no capture at all. */
async function served(page: Page) {
	const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
	const buildId = buildStamp(stamp ?? undefined);
	const revision = process.env.HARNESS_VERIFY_REVISION ?? '';
	if (!buildId) throw new Error('The rendered build has no compiled identity stamp');
	if (process.env.HARNESS_VERIFY !== '1' || !/^[a-f0-9]{40}$/.test(revision))
		throw new Error('A verification revision is required to record a usage capture');
	return { buildId, revision };
}

/**
 * In a verification, a picture that stands for a state is recorded as that state's evidence:
 * the whole page of the stamped build, at a viewport and a state the scenario declares, taken
 * once the sections it is of are shown and fonts and images are ready.
 */
async function evidenced(page: Page, name: string): Promise<void> {
	const picture = pictures[name];
	if (!picture || !evidenceRequested()) return;
	for (const section of picture.shown)
		await page.getByRole('region', { name: section, exact: true }).waitFor();
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	const server = await served(page);
	const size = page.viewportSize();
	const viewport = scenario.viewports.find(
		(item) => item.width === size?.width && item.height === size.height
	)?.id;
	if (!viewport) throw new Error('The capture viewport is not declared by desktop-renderer');
	const { state } = picture;
	const evidence = scenario.evidence.find(
		(item) => item.id === `usage-screens-${viewport}` && item.states.includes(state)
	);
	if (!evidence) throw new Error(`The state ${state} is not declared for ${viewport}`);
	recordCapture(
		{
			evidence: evidence.id,
			kind: 'screenshot',
			state,
			viewport,
			file: `ui-${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server,
			note
		},
		await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
	);
}

/**
 * The opt-in picture of a run, whole page, taken once fonts and images are ready and before what
 * it shows is judged. SCREENSHOT_LABEL names the phase and ENTITY_USAGE_SHOTS the folder, so a
 * run before a change and one after it never write the same file.
 */
export async function pictured(page: Page, info: TestInfo, name: string): Promise<void> {
	await evidenced(page, name);
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	const folder = process.env.ENTITY_USAGE_SHOTS ?? info.outputDir;
	const file = `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}.png`;
	await page.screenshot({ path: join(folder, file), fullPage: true, animations: 'disabled' });
}
