import { Software3dAdapter } from '../../../../../game/src/adapters/game-authoring/Software3dAdapter';
import { createRun, stepGame } from '../../../../../game/src/utils/game-authoring/gameStep';
import { exampleDocument } from '../../../../../game/src/utils/game-authoring/keyDoor';
import type { Evidence, Report } from '../../../../src/models/reports-media/Report.types';

/** Render a short synthetic key-and-door run with the actual game fallback renderer. */
export function gameplayReplayFixture(report: Report, picture: Evidence): Report {
	if (
		typeof location === 'undefined' ||
		new URLSearchParams(location.search).get('unit') !== 'reports.component.gameplay-replay'
	)
		return report;
	const view = exampleDocument('3d').views[0];
	const canvas = document.createElement('canvas');
	canvas.width = 920;
	canvas.height = 520;
	const renderer = new Software3dAdapter(canvas);
	const start = createRun(7, view);
	const key = stepGame(start, { x: 2, y: 0 }, view);
	const door = stepGame(key, { x: 2, y: 0 }, view);
	const titles = ['Scene 1: Courtyard', 'Scene 2: Key collected', 'Scene 3: Door unlocked'];
	const evidence = [start, key, door].map((run, index) => {
		renderer.render(run, view);
		return {
			...picture,
			id: `game-frame-${index + 1}`,
			title: titles[index],
			category: 'Gameplay',
			file: canvas.toDataURL('image/png'),
			mimeType: 'image/png',
			order: index,
			source: 'Synthetic game renderer fixture'
		};
	});
	renderer.dispose();
	return { ...report, title: 'Courtyard gameplay', evidence };
}
