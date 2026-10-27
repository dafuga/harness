import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { expect, test, vi } from 'vitest';
import { PNG } from 'pngjs';
import {
	author,
	contract,
	fixture as planningFixture
} from '../../../packages/planning/test/planFixture';
import {
	featurePlanImage,
	registerFeaturePlanImage
} from '../../../src/utils/agents-providers/featurePlanImage';

const image = {
	id: 'o2',
	version: 'v001',
	commit: 'a'.repeat(40),
	path: 'images/choice.png',
	sha256: 'b'.repeat(64),
	preferred: true
};
const digest = 'c'.repeat(64);
const plan = { digest, pages: [{ module: 'page.orders', options: [image] }] };

function fixture(output: string) {
	const repository = { read: vi.fn().mockResolvedValue({ plans: [plan] }) };
	const readImage = vi.fn().mockResolvedValue({ bytes: Uint8Array.of(1, 2, 3) });
	return {
		input: { feature: 'checkout', page: 'page.orders', option: 'o2', digest, output },
		dependencies: { repository, readImage },
		repository,
		readImage
	};
}

test('featurePlanImage reads the exact committed option and writes the returned bytes', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'harness-plan-image-'));
	try {
		const f = fixture(join(dir, 'choice.png'));
		await featurePlanImage(f.input, f.dependencies);
		expect(f.repository.read).toHaveBeenCalledExactlyOnceWith('checkout');
		expect(f.readImage).toHaveBeenCalledExactlyOnceWith({
			unitId: 'page.orders',
			version: image.version,
			file: image.path,
			revision: image.commit,
			sha256: image.sha256,
			option: image.id
		});
		expect(await readFile(f.input.output)).toEqual(Buffer.from([1, 2, 3]));
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test('featurePlanImage refuses missing options, failed reads and existing destinations', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'harness-plan-image-'));
	try {
		const f = fixture(join(dir, 'choice.png'));
		for (const [pages, page, option] of [
			[[], 'page.orders', 'o2'],
			[plan.pages, 'page.unknown', 'o2'],
			[plan.pages, 'page.orders', 'o1']
		] as const) {
			f.repository.read.mockResolvedValueOnce({ plans: pages.length ? [{ digest, pages }] : [] });
			await expect(
				featurePlanImage({ ...f.input, page, option }, f.dependencies)
			).rejects.toThrow();
		}
		expect(f.readImage).not.toHaveBeenCalled();
		await expect(
			featurePlanImage({ ...f.input, digest: 'd'.repeat(64) }, f.dependencies)
		).rejects.toThrow();
		expect(f.readImage).not.toHaveBeenCalled();
		f.readImage.mockRejectedValueOnce(new Error('invalid image'));
		await expect(featurePlanImage(f.input, f.dependencies)).rejects.toThrow('invalid image');
		await expect(readFile(f.input.output)).rejects.toMatchObject({ code: 'ENOENT' });
		await writeFile(f.input.output, 'keep');
		await expect(featurePlanImage(f.input, f.dependencies)).rejects.toMatchObject({
			code: 'EEXIST'
		});
		expect(await readFile(f.input.output, 'utf8')).toBe('keep');
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

async function committedImageFixture() {
	const { root, api } = await planningFixture();
	await api.createPlan({
		category: 'page',
		slug: 'home',
		title: 'Home',
		goal: 'Home',
		author,
		contract
	});
	const png = (width: number) => PNG.sync.write(new PNG({ width, height: 2 }));
	const choiceBytes = png(3);
	const design = await api.addDesign({
		unitId: 'page.home',
		prompt: 'Home',
		generator: { provider: 'fixture', model: 'fixture' },
		options: [
			{ direction: 'One', images: [{ state: 'default', viewport: 'desktop', bytes: png(2) }] },
			{ direction: 'Two', images: [{ state: 'default', viewport: 'desktop', bytes: choiceBytes }] }
		]
	});
	const choice = design.value.options?.[1];
	if (!choice) throw new Error('Expected committed option');
	const artifact = choice.images[0];
	const option = {
		id: choice.id,
		version: design.value.version,
		commit: design.commit,
		path: artifact.file,
		sha256: artifact.sha256,
		preferred: true
	};
	const repository = {
		read: async () => ({
			plans: [
				{ digest, pages: [] },
				{ digest, pages: [{ module: 'page.home', options: [option] }] }
			]
		})
	};
	const input = {
		feature: 'home',
		page: 'page.home',
		option: choice.id,
		digest,
		output: join(root, 'choice.png')
	};
	const dependencies = {
		repository,
		readImage: (query: Parameters<typeof api.readImage>[0]) => api.readImage(query)
	};
	return { root, input, dependencies, choiceBytes, option };
}

test('featurePlanImage reads an actual committed planning option and rejects a changed hash', async () => {
	const { root, input, dependencies, choiceBytes, option } = await committedImageFixture();
	const command = new Command();
	const output = vi.fn();
	registerFeaturePlanImage(command, (value) => featurePlanImage(value, dependencies), output);
	await command.parseAsync(
		[
			'image',
			input.feature,
			'--page',
			input.page,
			'--option',
			input.option,
			'--digest',
			input.digest,
			'--output',
			input.output
		],
		{ from: 'user' }
	);
	expect(output).toHaveBeenCalledExactlyOnceWith(`Saved ${input.output}`);
	expect(await readFile(input.output)).toEqual(choiceBytes);
	option.sha256 = '0'.repeat(64);
	await expect(
		featurePlanImage({ ...input, output: join(root, 'bad.png') }, dependencies)
	).rejects.toThrow();
	await expect(readFile(join(root, 'bad.png'))).rejects.toMatchObject({ code: 'ENOENT' });
}, 30_000);
