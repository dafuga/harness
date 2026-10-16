import type { Page } from '@playwright/test';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import scenarioData from '../../../../specification/scenarios/shells-shared-app.json' with { type: 'json' };
import { buildStamp } from '../../../../src/utils/buildStamp';
import { evidenceRequested, recordCapture } from '../../../../src/utils/recordCapture';
import { projectFixture } from './ui-project-fixture';

export const shell = 'desktop.component.workspace-shell';
const scenario = scenarioData as ScenarioManifest;
const note =
	'Actual compiled renderer over SYNTHETIC projects; the shell entity is added to their fixture catalogs. Only the build and revision identify tested software.';

/** A project fixture, local or hosted, with the shared workspace shell among each project's entities. */
export async function withShell(page: Page, fixture = projectFixture): Promise<void> {
	await fixture(page);
	await page.addInitScript((id: string) => {
		type Entity = Record<string, unknown>;
		const host = window as unknown as {
			__projects: { data: { projects: Array<{ entities: Entity[] }> } };
		};
		for (const project of host.__projects.data.projects) {
			const button = project.entities.find((entity) => entity.category === 'components');
			project.entities.push({
				...button,
				id,
				category: 'shells',
				kind: 'shell',
				title: 'Shared workspace shell',
				summary: 'Lays out the one workspace every Harness app shows.',
				threads: [],
				versions: []
			});
		}
	}, shell);
}

/** The compiled build the page was served from and the revision under verification. */
async function served(page: Page) {
	const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
	const buildId = buildStamp(stamp ?? undefined);
	const revision = process.env.HARNESS_VERIFY_REVISION ?? '';
	if (!buildId) throw new Error('The rendered build has no compiled identity stamp');
	if (process.env.HARNESS_VERIFY !== '1' || !/^[a-f0-9]{40}$/.test(revision))
		throw new Error('A verification revision is required to record a Shells capture');
	return { buildId, revision };
}

/**
 * In a verification, the page as it is once a state was checked is that state's capture: the
 * whole page of the stamped build, at a viewport the scenario declares for the state.
 */
export async function evidenced(page: Page, state: string): Promise<void> {
	if (!evidenceRequested()) return;
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
	const evidence = scenario.evidence.find(
		(item) =>
			item.kind === 'screenshot' &&
			item.states.includes(state) &&
			item.viewports.includes(viewport ?? '')
	);
	if (!viewport || !evidence)
		throw new Error(`shells-shared-app declares no ${state} capture here`);
	recordCapture(
		{
			evidence: evidence.id,
			kind: 'screenshot',
			state,
			viewport,
			file: `shells-${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server,
			note
		},
		await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
	);
}
