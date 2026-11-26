// @harness-uid u_iuege4bu7o
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { designsRoot } from '../../../../packages/reports/src/utils/planning-collaboration/canvasManifest';
import { DesignCanvasError } from '../../../../packages/reports/src/models/planning-collaboration/DesignCanvasError';
import type { DesignCanvasData } from '../../../../packages/reports/src/utils/planning-collaboration/designCanvas.types';
import { canvasArtifact } from './canvasArtifact';
import { committedCanvas } from './committedCanvas';
import type { Attach } from './attachCanvas.types';

/** Records a committed, pushed canvas as an artifact of one tracker item's planning stage. */
export function attachCanvas(canvas: DesignCanvasData, { root, item, stage, viewer }: Attach) {
	if (!/^[a-z0-9]{4,20}$/.test(item)) throw new DesignCanvasError('--item is a tracker id.');
	const source = committedCanvas(root, `${designsRoot}/${canvas.name}`);
	const shown = JSON.parse(tracker(['show', item, '--json']));
	const artifact = canvasArtifact(
		canvas,
		{ ...source, viewer },
		shown.planning?.artifacts?.[stage]
	);
	const folder = mkdtempSync(join(tmpdir(), 'harness-design-'));
	try {
		const file = join(folder, 'artifact.json');
		writeFileSync(file, JSON.stringify(artifact));
		tracker(['artifact', item, stage, file]);
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
	return artifact;
}

function tracker(args: string[]): string {
	return execFileSync('tracker', args, { encoding: 'utf8', timeout: 30_000 });
}
