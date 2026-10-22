import type { BrowserWindow, Dialog } from 'electron';

/**
 * A page that refuses to unload, because it holds unsaved work, is asked about natively: Electron
 * shows nothing by itself and would keep the window open in silence. Stay keeps the page and the
 * window; Discard lets the reload, close or quit go on.
 */
export function confirmUnload(
	window: BrowserWindow,
	dialog: Pick<Dialog, 'showMessageBoxSync'>
): void {
	window.webContents.on('will-prevent-unload', (event) => {
		const choice = dialog.showMessageBoxSync(window, {
			type: 'warning',
			buttons: ['Stay', 'Discard'],
			defaultId: 0,
			cancelId: 0,
			message: 'Discard unsaved changes?',
			detail: 'Stay keeps this window and its unsaved changes open.'
		});
		if (choice === 1) event.preventDefault();
	});
}
