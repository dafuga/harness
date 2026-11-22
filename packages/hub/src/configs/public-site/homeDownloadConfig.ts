// @harness-uid u_rrdlbnlg6j
import type { HomeDownloads } from './homeDownloadConfig.types';

/**
 * The homepage's download links. The Mac archive is asked for on each visit, so publishing the
 * release switches the button on without rebuilding the site. The iPhone app stays pending until
 * a verified store address is set here.
 */
export const homeDownloadConfig: HomeDownloads = {
	mac: { path: '/downloads/Harness-mac-arm64.zip', mediaType: 'application/zip' },
	ios: null
};

export type { HomeDownloads } from './homeDownloadConfig.types';
