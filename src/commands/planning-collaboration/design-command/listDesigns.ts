// @harness-uid u_zy3vg5aj7v
import { artboardViolations } from '../../../../packages/reports/src/utils/planning-collaboration/artboardViolations';
import type { DesignCanvasData } from '../../../../packages/reports/src/utils/planning-collaboration/designCanvas.types';
import type { DesignCanvasService } from '../../../services/planning-collaboration/design-canvas-service/DesignCanvasService';

/** The text or JSON of `harness design list`. */
export function listDesigns(service: DesignCanvasService, canvas?: string, json?: boolean) {
	if (!canvas) {
		const rows = service.names().map((name) => {
			const { title, artboards } = service.manifest(name);
			return { name, title, artboards: artboards.length };
		});
		if (json) return JSON.stringify(rows);
		return rows.map((r) => `${r.name}  ${r.artboards} artboards  ${r.title}`).join('\n');
	}
	const rows = boardRows(service.read(canvas));
	if (json) return JSON.stringify(rows);
	return rows
		.map((r) => `${r.file}  ${r.size}  at ${r.x},${r.y}  ${r.title}${notes(r.problems)}`)
		.join('\n');
}

const notes = (problems: string[]) => problems.map((p) => `\n  problem: ${p}`).join('');

function boardRows({ boards }: DesignCanvasData) {
	return boards.map(({ file, title, width, height, x, y, html, problem }) => ({
		file,
		title,
		size: `${width}x${height}`,
		x,
		y,
		problems: html ? artboardViolations(html) : [problem!]
	}));
}
