import { beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
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
let started: number | undefined;
beforeEach(() => {
	started = evidenceRequested() ? performance.now() : undefined;
});
/** Timing and RSS of the actual standard case, including its mocks, fixtures and assertions. */
afterEach(({ task }) => {
	if (started === undefined) return;
	const file = task.file.filepath
		.replaceAll('\\', '/')
		.split('/packages/')[1]
		?.replace(/\.test\.ts$/, '');
	const unit = file ? owners[file] : undefined;
	if (!unit) return;
	const common = { unit, workload: task.name, target: 'process', samples: 1 };
	const measurements = [
		{
			...common,
			metric: 'behavior-case-duration-ms',
			unitOfMeasure: 'ms',
			value: performance.now() - started,
			method:
				'Wall time of the existing standard behavior case, including deterministic mocks, fixtures and assertions; not production provider, network or GPU latency.'
		},
		{
			...common,
			metric: 'worker-rss-bytes',
			unitOfMeasure: 'bytes',
			value: process.memoryUsage().rss,
			method:
				'Whole Vitest worker RSS after the case including shared runtime and fixtures; not isolated unit memory or peak RSS.'
		}
	];
	recordCapture(
		{
			evidence: 'game-behavior-benchmarks',
			kind: 'benchmark',
			state: task.name,
			file: 'game-behavior-' + randomUUID() + '.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
});
