import { link, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Command } from 'commander';
import { createPlanning } from '../../../packages/planning/src';
import type { PlanningApi } from '../../../packages/planning/src';
import { FeaturePlanRepository } from '../../repositories/agents-providers/FeaturePlanRepository';
import type { FeaturePlan } from '../../repositories/agents-providers/ModuleTaskRepository.types';

function defaults() {
	const root = process.cwd();
	return {
		repository: new FeaturePlanRepository(root),
		readImage: async (input: Parameters<PlanningApi['readImage']>[0]) =>
			(await createPlanning(root)).readImage(input)
	};
}

async function writeNewImage(output: string, bytes: Uint8Array) {
	const directory = await mkdtemp(join(dirname(output), '.harness-plan-image-'));
	try {
		const temporary = join(directory, 'image');
		await writeFile(temporary, bytes, { flag: 'wx' });
		await link(temporary, output);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

export async function featurePlanImage(
	input: { feature: string; page: string; option: string; digest: string; output: string },
	dependencies: {
		repository: {
			read(feature: string): Promise<{ plans: Pick<FeaturePlan, 'pages' | 'digest'>[] }>;
		};
		readImage(input: Parameters<PlanningApi['readImage']>[0]): Promise<{ bytes: Uint8Array }>;
	} = defaults()
): Promise<void> {
	if (!input.output || input.output === '-') throw new Error('An output file is required.');
	const { plans } = await dependencies.repository.read(input.feature);
	const plan = plans.at(-1);
	if (!plan) throw new Error(`No feature plan found for ${input.feature}.`);
	if (plan.digest !== input.digest) throw new Error('Feature plan digest is stale.');
	const page = plan.pages.find((item) => item.module === input.page);
	if (!page) throw new Error(`No page ${input.page} in feature plan.`);
	const option = page.options.find((item) => item.id === input.option);
	if (!option) throw new Error(`No option ${input.option} for ${input.page}.`);
	const image = await dependencies.readImage({
		unitId: page.module,
		version: option.version,
		file: option.path,
		revision: option.commit,
		sha256: option.sha256,
		option: option.id
	});
	await writeNewImage(input.output, image.bytes);
}

export function registerFeaturePlanImage(
	plan: Command,
	image: typeof featurePlanImage,
	output: (text: string) => void
) {
	plan
		.command('image <feature>')
		.requiredOption('--page <id>')
		.requiredOption('--option <id>')
		.requiredOption('--digest <sha>')
		.requiredOption('--output <file>')
		.action(
			async (
				feature: string,
				options: { page: string; option: string; digest: string; output: string }
			) => {
				await image({ feature, ...options });
				output(`Saved ${options.output}`);
			}
		);
}
