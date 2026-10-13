import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
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

/**
 * The opt-in picture of a run, whole page, taken once fonts and images are ready and before what
 * it shows is judged. SCREENSHOT_LABEL names the phase and ENTITY_USAGE_SHOTS the folder, so a
 * run before a change and one after it never write the same file.
 */
export async function pictured(page: Page, info: TestInfo, name: string): Promise<void> {
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
