import { hubContractHash, hubHash } from '../../src/utils/hubJson';
import { commit, unit, projectionFixture } from './projectionFixture';
export async function designFixture() {
	const f = projectionFixture(),
		path = 'src/pages/example',
		contract = {
			responsibility: 'Review pages',
			inputs: [],
			outputs: [],
			errors: [],
			states: ['default'],
			viewports: ['desktop']
		};
	const png = new Uint8Array(
		Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==',
			'base64'
		)
	);
	const prompt = new TextEncoder().encode('Show this page'),
		hash = await hubHash(png),
		contractHash = await hubContractHash(contract);
	const plan = fixturePlan(path, contract, contractHash);
	const design = {
		unitId: unit.id,
		version: 'v001',
		createdAt: plan.createdAt,
		generator: { provider: 'GPT Image', model: 'test' },
		prompt: { file: 'prompt.md', sha256: await hubHash(prompt) },
		notes: null,
		baseRevision: commit,
		contract,
		contractHash,
		images: [
			{
				file: 'default-desktop.png',
				state: 'default',
				viewport: 'desktop',
				sha256: hash,
				bytes: png.length,
				width: 1,
				height: 1
			}
		]
	};
	const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
	f.files.set(path + '/plan.json', json(plan));
	f.files.set(path + '/designs/v001/design.json', json(design));
	f.files.set(path + '/designs/v001/prompt.md', prompt);
	f.files.set(path + '/designs/v001/default-desktop.png', png);
	return { ...f, path, plan, design, png, hash, json };
}

function fixturePlan(
	path: string,
	contract: {
		responsibility: string;
		inputs: never[];
		outputs: never[];
		errors: never[];
		states: string[];
		viewports: string[];
	},
	contractHash: string
) {
	return {
		unitId: unit.id,
		category: 'page',
		slug: 'example',
		title: 'Example',
		goal: 'Review pages',
		path,
		createdAt: '2026-10-12T00:00:00Z',
		baseRevision: commit,
		contract,
		contractHash
	};
}
