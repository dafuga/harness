import { beforeEach, afterEach } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { captureLineSchema } from '../../src/core/verifyTypes';
import { evidenceRequested, recordCapture } from '../../src/utils/record-capture/recordCapture';
const owners: Record<string, string> = {
	'game/test/index': 'game.entry.index',
	'game/test/adapters/canvas2d': 'game.function.draw2d',
	'game/test/adapters/three-scene': 'game.function.create3d',
	'game/test/adapters/software3d': 'game.function.software3d',
	'game/test/adapters/gpt-image': 'game.adapter.gpt-image',
	'game/test/adapters/decart': 'game.adapter.decart',
	'game/test/utils/connect-decart': 'game.function.connect-decart',
	'game/test/repositories/game-document': 'game.repository.game-document',
	'game/test/repositories/checkpoint-image': 'game.repository.checkpoint-image',
	'game/test/utils/checkpoint-graph': 'game.function.checkpoint-graph',
	'game/test/utils/key-door': 'game.function.key-door',
	'game/test/utils/game-step': 'game.function.game-step',
	'desktop/test/services/game-image': 'desktop.service.game-image',
	'desktop/test/services/game-project': 'desktop.service.game-project',
	'desktop/test/services/game-render': 'desktop.service.game-render',
	'desktop/test/adapters/project-game-credential': 'desktop.function.project-game-credential',
	'desktop/test/utils/project-game-credential': 'desktop.function.project-game-credential',
	'desktop/test/components/game-text-field': 'desktop.component.game-text-field'
};
/** Standard cases exercise several owners; labels retain the whole-case/process scope. */
function caseOwners(file: string, name: string): string[] {
	const matching = workloads[file]?.find(([pattern]) => pattern.test(name));
	if (matching) return matching[1];
	return owners[file] ? [owners[file]] : [];
}
const workloads: Record<string, [RegExp, string[]][]> = {
	'root/utils/source-blocks': [[/.*/, ['function.source-blocks', 'function.block-spans']]],
	'game/test/repositories/game-document': [
		[/.*/, ['game.repository.game-document', 'game.validator.game-document']]
	],
	'game/test/index': [
		[
			/dimensions validate|cyclic prerequisites|image metadata/,
			['game.entry.index', 'game.validator.game-document']
		]
	],
	'desktop/test/desktop-startup': [
		[/^a page that refuses/, ['desktop.module.initialize-desktop-confirm-unload']]
	],
	'desktop/test/services/game-project': [
		[/^invalid game requests/, ['desktop.function.game-payload']],
		[/^AI preview|^prepared token/, ['desktop.service.game-render']],
		[/^game operations/, ['desktop.service.game-project', 'desktop.service.game-render']]
	],
	'desktop/test/services/game-image': [[/^image IPC/, ['desktop.function.game-payload']]],
	'root/game-project': [
		[/^embedded engine/, ['template.game-sources']],
		[/.*/, ['template.game-project', 'template.project-tests']]
	],
	'root/game-cli.e2e': [
		[
			/^game-only/,
			[
				'template.game-project',
				'template.game-pieces',
				'template.game-scaffold-details',
				'template.project-tests'
			]
		],
		[/.*/, ['template.game-project', 'template.game-pieces', 'template.project-tests']]
	]
};
let started: number | undefined;
beforeEach(() => {
	started = evidenceRequested() ? performance.now() : undefined;
});
/** Timing and RSS of the actual standard case, including its mocks, fixtures and assertions. */
afterEach(({ task }) => {
	if (started === undefined) return;
	const normalized = task.file.filepath.replaceAll('\\', '/');
	const file = (
		normalized.includes('/packages/')
			? normalized.split('/packages/')[1]
			: 'root/' + normalized.split('/test/')[1]
	).replace(/\.test\.ts$/, '');
	const units = caseOwners(file, task.name);
	if (!units.length) return;
	const elapsedMs = performance.now() - started;
	const rssBytes = process.memoryUsage().rss;
	const caseId =
		'case-' +
		createHash('sha256')
			.update(file + '\n' + task.name)
			.digest('hex')
			.slice(0, 24);
	const measurements = units.flatMap((unit) => {
		const common = { unit, workload: caseId, target: 'process', samples: 1 };
		return [
			{
				...common,
				metric: 'behavior-case-duration-ms',
				unitOfMeasure: 'ms',
				value: elapsedMs,
				method: `Standard case "${task.name}": wall time including deterministic mocks, fixtures and assertions; not production provider, network or GPU latency.`
			},
			{
				...common,
				metric: 'worker-rss-bytes',
				unitOfMeasure: 'bytes',
				value: rssBytes,
				method:
					'Whole Vitest worker RSS after the case including shared runtime and fixtures; not isolated unit memory or peak RSS.'
			}
		];
	});
	recordCapture(
		captureLineSchema.parse({
			evidence: 'game-behavior-benchmarks',
			kind: 'benchmark',
			state: caseId,
			file: 'game-behavior-' + randomUUID() + '.json',
			mediaType: 'application/json'
		}),
		JSON.stringify({ measurements })
	);
});
