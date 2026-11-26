// @harness-uid u_z3z374gyr7
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser } from '@playwright/test';
import { artboardDocument } from '../../../../packages/reports/src/utils/planning-collaboration/artboardDocument';
import { DesignCanvasError } from '../../../../packages/reports/src/models/planning-collaboration/DesignCanvasError';
import type {
	ArtboardTheme,
	CanvasBoard
} from '../../../../packages/reports/src/utils/planning-collaboration/designCanvas.types';
import { loadChromium } from './loadChromium';
import type { RenderRequest } from './renderCanvas.types';

/** One PNG per artboard and theme, at its declared size, with scripts off and no network. */
export async function renderCanvas({ root, out, boards, themes }: RenderRequest) {
	const broken = boards.filter((board) => board.problem);
	if (broken.length)
		throw new DesignCanvasError(broken.map((b) => `${b.file}: ${b.problem}`).join('\n'));
	const browser = await (await loadChromium(root)).launch();
	try {
		mkdirSync(out, { recursive: true });
		const written: string[] = [];
		for (const board of boards)
			for (const theme of themes) {
				const path = join(out, `${board.file.slice(0, -5)}.${theme}.png`);
				await shoot(browser, board, { theme, path });
				written.push(path);
			}
		return written;
	} finally {
		await browser.close();
	}
}

async function shoot(
	browser: Browser,
	board: CanvasBoard,
	{ theme, path }: { theme: ArtboardTheme; path: string }
) {
	const context = await browser.newContext({
		viewport: { width: board.width, height: board.height },
		deviceScaleFactor: 1,
		colorScheme: theme,
		javaScriptEnabled: false
	});
	try {
		await context.route('**/*', (route) => route.abort());
		const page = await context.newPage();
		await page.setContent(artboardDocument(board.html, theme), { waitUntil: 'load' });
		await page.screenshot({ path });
	} finally {
		await context.close();
	}
}
