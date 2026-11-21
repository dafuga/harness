// @harness-uid u_rrdlbnlg6j
import type { HomeDownloads } from './homeDownloadConfig.types';

/**
 * The homepage's download links. A build is linked only once it is published; until then the page
 * says it is coming instead of offering a link that goes nowhere.
 */
export const homeDownloadConfig: HomeDownloads = {
	mac: null,
	ios: null
};

export type { HomeDownloads } from './homeDownloadConfig.types';
