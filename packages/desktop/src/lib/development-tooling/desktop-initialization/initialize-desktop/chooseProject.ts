// @harness-uid u_whjk3tinmf
import type { BrowserWindow, Dialog } from 'electron';

/** The folder a person picks to open as a project, or null when they cancel. */
export async function chooseProject(window: BrowserWindow, dialog: Dialog): Promise<string | null> {
	const result = await dialog.showOpenDialog(window, {
		title: 'Open a Harness project',
		properties: ['openDirectory']
	});
	return result.canceled ? null : (result.filePaths[0] ?? null);
}
