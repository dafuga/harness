// @harness-uid u_6xtgyda5qj
import { join, resolve } from 'node:path';
import { DesignCanvasError } from '../../../../packages/reports/src/models/planning-collaboration/DesignCanvasError';
import type { DesignCanvasService } from '../../../services/planning-collaboration/design-canvas-service/DesignCanvasService';
import { renderCanvas } from '../../../services/planning-collaboration/design-canvas-service/renderCanvas';

/** Renders the whole canvas, or one artboard of it, in the asked themes. */
export function renderDesign(
	service: DesignCanvasService,
	canvas: string,
	{ out, theme, artboard }: Record<string, string | undefined>
) {
	const boards = service
		.read(canvas)
		.boards.filter((board) => !artboard || board.file === `${artboard}.html`);
	if (!boards.length) throw new DesignCanvasError('There is no artboard to render.');
	return renderCanvas({
		root: service.root,
		out: resolve(service.root, out ?? join('output', 'designs', canvas)),
		boards,
		themes: theme === 'light' || theme === 'dark' ? [theme] : ['light', 'dark']
	});
}
