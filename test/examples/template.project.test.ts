import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { projectFiles } from '../../src/templates/projects-sessions/project';
import type { ProjectTemplateInput } from '../../src/templates/projects-sessions/project.types';

function summary(input: ProjectTemplateInput) {
	const files = projectFiles(input);
	const readme = files.find((file) => file.path === 'README.md');
	return {
		paths: files.map((file) => file.path),
		readme: readme?.contents
	};
}

test('Plans app, library, and game project scaffolds', () => {
	const inputs: ProjectTemplateInput[] = [
		{ name: 'inventory-app', kind: 'app' },
		{ name: 'shared-utils', kind: 'lib' },
		{ name: 'terrain-demo', kind: 'game', dimension: '3d' }
	];
	const outputs = inputs.map(summary);

	expect(outputs[0]?.paths).toContain('src/routes/+page.svelte');
	expect(outputs[0]?.readme).toContain('# inventory-app');
	expect(outputs[1]?.paths).toContain('src/index.ts');
	expect(outputs[1]?.readme).toContain('A Harness Bun TypeScript library.');
	expect(outputs[2]?.paths).toContain('src/routes/+page.svelte');
	expect(outputs[2]?.readme).toContain('# terrain-demo');

	recordExampleCases(
		{
			unitId: 'template.project',
			symbol: 'projectFiles',
			state: 'plans-app-library-and-game-project-scaffolds',
			evidence: 'examples-cases',
			file: 'plans-app-library-and-game-project-scaffolds.json'
		},
		inputs.map((input, index) => ({
			name: `${input.kind} scaffold for ${input.name}`,
			input,
			output: outputs[index]
		}))
	);
});
