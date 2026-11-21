import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RunContext } from '../../models/development-tooling/RunContext.types';
import type { DesignVersion } from '../../models/planning-collaboration/DesignVersion.types';
import type { MockupSource } from './mockupSource.types';
import { beforeState, mockupHtml, mockupSource } from './mockupSource';

async function writeSource(target: string, source: MockupSource, option: number) {
	const states = [
		{ id: 'default', after: source.options[option], before: source.before },
		...source.states.map((state) => ({
			id: state.id,
			after: state.options[option],
			before: state.before
		}))
	];
	for (const { id, after, before } of states) {
		await writeFile(join(target, id + '-after.html'), mockupHtml(after, source.projectCss));
		if (before)
			await writeFile(join(target, id + '-before.html'), mockupHtml(before, source.projectCss));
	}
}

async function writeScreenshots(context: RunContext, version: DesignVersion, target: string) {
	const approval = context.request.approval!;
	const images = version.images.filter((image) => image.option === approval.option);
	const bytes = await context.planning.images({
		entityId: context.entity.id,
		version: approval.version,
		option: approval.option,
		revision: context.revision.commit,
		hashes: images.map((image) => image.sha256)
	});
	const screenshots = images.map(({ state, viewport, sha256 }, index) => ({
		file: `capture-${index + 1}.png`,
		state,
		viewport,
		sha256
	}));
	for (const [index, screenshot] of screenshots.entries())
		await writeFile(join(target, screenshot.file), bytes[index]);
	return screenshots;
}

export async function approvedMockup(
	context: RunContext,
	version: DesignVersion,
	directory: string
) {
	const source = mockupSource(version.notes);
	if (!source) return null;
	const approval = context.request.approval!;
	const option = version.options?.findIndex(({ id }) => id === approval.option) ?? -1;
	if (option < 0 || !source.options[option]) throw new Error('Approved mockup source is missing.');
	const target = join(directory, 'approved-mockup');
	await mkdir(target);
	await writeSource(target, source, option);
	const screenshots = await writeScreenshots(context, version, target);
	await writeFile(
		join(target, 'review.json'),
		JSON.stringify(
			{
				option: approval.option,
				direction: source.options[option].direction,
				baseRevision: version.baseRevision,
				sources: source.sources,
				stylesheets: source.stylesheets,
				screenshots
			},
			null,
			2
		)
	);
	const primary =
		screenshots.find(({ state, viewport }) => state === 'default' && viewport === 'width-1440') ??
		screenshots.find(({ state }) => !state.startsWith(beforeState));
	if (!primary) throw new Error('The approval holds no proposed screenshot.');
	return { directory: target, reference: join(target, primary.file) };
}
