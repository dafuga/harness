import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImpactReport } from '../../src/core/impactTypes';
import { runCommand } from './cli';
import { slugifySource, titleServiceSource, unitProject, type UnitProject } from './unitProject';

export interface ImpactRepo extends UnitProject {
	commit(message: string): Promise<string>;
	impact(args?: string[]): Promise<ImpactReport>;
	remove(path: string): Promise<void>;
	dispose(): Promise<void>;
}

const identity = [
	'-c',
	'user.name=Harness Fixture',
	'-c',
	'user.email=fixture@harness.invalid',
	'-c',
	'commit.gpgsign=false'
];

export const serviceSource = (name: string, imported: string, from: string): string =>
	[
		`import { ${imported} } from '${from}';`,
		'',
		`export class ${name}Service {`,
		'\trun(value: string): string {',
		`\t\treturn ${imported}(value);`,
		'\t}',
		'}',
		''
	].join('\n');

export const testSource = (subject: string, from: string): string =>
	`import { ${subject} } from '${from}';\n\nexport const subject = ${subject};\n`;

export function scenario(id: string, unit: string, test: string): string {
	return JSON.stringify({
		schemaVersion: 1,
		id,
		title: `${id} scenario`,
		kind: 'headless',
		units: [unit],
		states: [{ id: 'default', title: 'Default', coverage: 'required' }],
		viewports: [],
		tests: [{ id: 'unit', kind: 'unit', runner: 'vitest', target: test }],
		evidence: [{ id: 'output', kind: 'output', states: ['default'], viewports: [], required: true }]
	});
}

const fixtureFiles: Record<string, string> = {
	'src/utils/slugify.ts': slugifySource,
	'src/utils/clock.ts': 'export function clock(value: string): string {\n\treturn value;\n}\n',
	'src/services/TitleService.ts': titleServiceSource,
	'src/services/ClockService.ts': serviceSource('Clock', 'clock', '../utils/clock'),
	'src/lib/titles.ts': "export { slugify } from '../utils/slugify';\n",
	'src/services/FeedService.ts': serviceSource('Feed', 'slugify', '../lib/titles'),
	'test/services/title.test.ts': testSource('TitleService', '../../src/services/TitleService'),
	'test/services/clock.test.ts': testSource('ClockService', '../../src/services/ClockService'),
	'test/services/feed.test.ts': testSource('FeedService', '../../src/services/FeedService'),
	'test/utils/slugify.test.ts': testSource('slugify', '../../src/utils/slugify'),
	'specification/scenarios/titles.json': scenario(
		'titles',
		'service.title',
		'test/services/title.test.ts'
	),
	'specification/scenarios/clock.json': scenario(
		'clock',
		'service.clock',
		'test/services/clock.test.ts'
	)
};

/** A committed lib project: shared function, direct and re-exporting consumers, unrelated code. */
export async function impactRepo(): Promise<ImpactRepo> {
	const project = await unitProject('lib');
	const git = (args: string[]) => runCommand(['git', ...identity, ...args], project.root);
	for (const [path, contents] of Object.entries(fixtureFiles)) await project.write(path, contents);
	await project.harness(['units', 'index', '--write']);
	await git(['init', '-q', '-b', 'main']);
	const commit = async (message: string) => {
		await git(['add', '-A']);
		await git(['commit', '-q', '-m', message]);
		return (await git(['rev-parse', 'HEAD'])).stdout.trim();
	};
	await commit('chore: fixture baseline');
	return {
		...project,
		commit,
		impact: (args = []) => project.harnessJson<ImpactReport>(['impact', ...args]),
		remove: (path) => rm(join(project.root, path)),
		dispose: () => rm(join(project.root, '..'), { recursive: true, force: true })
	};
}
