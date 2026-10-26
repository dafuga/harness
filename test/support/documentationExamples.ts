import { expect } from 'vitest';
import { hydrateUnitDocumentation } from '../../src/services/revision-detail-service/unitDocumentation';
import { revisionRegistry } from '../../src/utils/revision-registry/revisionRegistry';
import { indexFiles, memoryTree, unitOf } from './memoryTree';

export async function assertTestingExamples() {
	const path = 'src/utils/finish.md';
	const markdown =
		'# Finish\n\n```harness-examples\n' +
		JSON.stringify({
			schemaVersion: 1,
			unitId: 'function.finish',
			examples: [{ name: 'Legacy', input: [], output: 'authored' }]
		}) +
		'\n```\n';
	const tree = memoryTree({
		'src/utils/finish.ts': 'export function finish(): void {}',
		[path]: markdown
	});
	const unit = unitOf(
		await indexFiles({ 'src/utils/finish.ts': 'export function finish(): void {}' }),
		'function.finish'
	);
	unit.testing = {
		version: 1,
		shape: 'helper',
		states: ['initialized'],
		examples: [
			{ subject: 'finish', name: 'Finish', call: 'finish()', input: [], expected: { kind: 'void' } }
		],
		cases: [
			{
				id: 'finish',
				state: 'initialized',
				subject: 'finish',
				example: 'Finish',
				test: { file: 'test/finish.test.ts', title: 'finish: Finish' }
			}
		]
	};
	unit.documentation = path;
	const registry = revisionRegistry([unit], [], new Map());
	await hydrateUnitDocumentation(tree, registry.units);
	expect(registry.units[0].documentation).toEqual({
		path,
		text: markdown,
		examples: [
			{ name: 'Legacy', input: [], output: 'authored' },
			{ name: 'finish: Finish', call: 'finish()', input: [], returns: 'void' }
		]
	});
}
