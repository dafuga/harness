import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/unitTypes';
import { revisionRegistry } from '../../src/utils/revision-registry/revisionRegistry';
import { ScenarioManifestValidator } from '../../src/validators/ScenarioManifestValidator';
import { ScenarioRepository } from '../../src/repositories/verification-evidence/ScenarioRepository';
import { videoEnrollment, videoEnrollmentTree } from '../support/videoEnrollmentFixture';

const scenario = (states: object[]) =>
	scenarioManifestSchema.parse({
		schemaVersion: 1,
		id: 'explorer',
		title: 'Explorer',
		kind: 'ui',
		units: ['page.functions', 'page.function', 'function.route'],
		states,
		viewports: [{ id: 'desktop', width: 1440, height: 900 }],
		tests: [{ id: 'flow', kind: 'e2e', runner: 'playwright', target: 'tests/e2e/flow.spec.ts' }],
		evidence: [
			{
				id: 'screens',
				kind: 'screenshot',
				states: ['catalog'],
				viewports: ['desktop'],
				required: true
			}
		]
	});

const plain = scenario([
	{ id: 'catalog', title: 'Catalog', coverage: 'required', units: ['page.functions'] }
]);
const enrolled = {
	...plain,
	units: ['page.functions'],
	states: plain.states.map((state) => ({ ...state, motion: 'required' as const })),
	video: videoEnrollment('page.functions', 'catalog', plain.viewports),
	evidence: [
		...plain.evidence,
		{
			id: 'motion',
			kind: 'video' as const,
			states: ['catalog'],
			viewports: ['desktop'],
			required: true
		}
	]
};

test('a state may name the units it shows, and the stored registry keeps what it names', async () => {
	const declared = scenario([
		{ id: 'catalog', title: 'Catalog', coverage: 'required', units: ['page.functions'] },
		{ id: 'entity', title: 'Entity', coverage: 'required', units: ['page.function'] }
	]);
	const [stored] = revisionRegistry([], [declared]).scenarios;
	expect(stored.states).toEqual([
		{ id: 'catalog', title: 'Catalog', coverage: 'required', units: ['page.functions'] },
		{ id: 'entity', title: 'Entity', coverage: 'required', units: ['page.function'] }
	]);

	expect(new ScenarioManifestValidator().validate(enrolled, 'explorer.json').errors).toEqual([]);
	const [saved] = revisionRegistry([], [enrolled]).scenarios;
	expect(saved).toMatchObject({
		video: enrolled.video,
		states: [expect.objectContaining({ motion: 'required' })]
	});
	expect((await new ScenarioRepository('.').read(videoEnrollmentTree(enrolled))).errors).toEqual(
		[]
	);
	const broken = videoEnrollmentTree(enrolled, { 'test/record.ts': 'export const record = 1;' });
	expect((await new ScenarioRepository('.').read(broken)).errors.join(' ')).toMatch(
		/callable|export/i
	);
});

test('a state that names no unit is stored as before, and a unit outside the scenario is refused', () => {
	const plain = scenario([{ id: 'catalog', title: 'Catalog', coverage: 'required' }]);
	expect(revisionRegistry([], [plain]).scenarios[0].states).toEqual([
		{ id: 'catalog', title: 'Catalog', coverage: 'required' }
	]);
	const foreign = scenario([
		{ id: 'catalog', title: 'Catalog', coverage: 'required', units: ['page.other'] }
	]);
	expect(new ScenarioManifestValidator().validate(foreign, 'explorer.json').errors).toEqual([
		'explorer: state catalog shows page.other, which the scenario does not cover'
	]);
	for (const invalid of [
		{ ...enrolled, states: plain.states },
		{ ...enrolled, states: plain.states.map((state) => ({ ...state, motion: 'none' })) },
		{
			...enrolled,
			video: { ...enrolled.video, viewports: [{ id: 'desktop', width: 1, height: 1 }] }
		},
		{ ...enrolled, evidence: plain.evidence },
		{
			...enrolled,
			video: {
				...enrolled.video,
				clips: enrolled.video.clips.map((clip) => ({ ...clip, unit: 'page.other' })),
				graphs: []
			}
		}
	])
		expect(
			new ScenarioManifestValidator().validate(invalid, 'explorer.json').errors.length
		).toBeGreaterThan(0);
	const stationary = {
		...enrolled,
		states: enrolled.states.map((state) => ({
			...state,
			motion: 'none' as const,
			motionReason: 'No rendered movement'
		}))
	};
	expect(new ScenarioManifestValidator().validate(stationary, 'explorer.json').errors).toEqual([]);
});
