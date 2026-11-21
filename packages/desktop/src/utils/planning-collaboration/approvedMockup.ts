import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RunContext } from '../../models/development-tooling/RunContext.types';
import type { DesignVersion } from '../../models/planning-collaboration/DesignVersion.types';
import { beforeState, mockupHtml, mockupSource } from './mockupSource';

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
	const images = version.images.filter((image) => image.option === approval.option);
	for (const image of images) {
		const index = images.indexOf(image);
		const file = join(target, `capture-${index + 1}.png`);
		await writeFile(
			file,
			await context.planning.image({
				entityId: context.entity.id,
				version: approval.version,
				option: approval.option,
				revision: context.revision.commit,
				sha256: image.sha256
			})
		);
	}
	const screenshots = images.map(({ state, viewport, sha256 }, index) => ({
		file: `capture-${index + 1}.png`,
		state,
		viewport,
		sha256
	}));
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
