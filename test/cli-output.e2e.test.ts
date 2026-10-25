import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test } from 'vitest';
import { commitModuleData, unitProject } from './support/unitProject';

test('JSON larger than a pipe buffer reaches a piped reader whole', async () => {
	const project = await unitProject('lib');
	try {
		await Promise.all(
			Array.from({ length: 256 }, (_, index) =>
				project.write(
					`src/utils/sample${index}.ts`,
					`export function sample${index}(): number { return ${index}; }\n`
				)
			)
		);
		await project.harness(['units', 'index', '--write']);
		await commitModuleData(project);
		const graph = await project.harness(['units', 'graph', '--json']);
		expect(graph.stdout.length).toBeGreaterThan(65_536);
		const parsed = JSON.parse(graph.stdout) as { nodes: unknown[] };
		expect(parsed.nodes.length).toBeGreaterThan(100);
		expect(graph.stdout.endsWith('}\n')).toBe(true);
	} finally {
		await rm(dirname(project.root), { recursive: true, force: true });
	}
}, 60_000);
