// @harness-uid u_3en7p2purk
import { shell } from 'electron';
import type { WebContents } from 'electron';
import { trackerArtifactUrlSchema } from '../../../../../../../src/utils/projects-sessions/trackerPlanning';
import { NavigationValidator } from '../../../../validators/explorer-ui/NavigationValidator';

/** Keep the privileged renderer on Harness and open its validated Tracker links externally. */
export function guardDesktopNavigation(contents: WebContents): void {
	const gate = new NavigationValidator();
	contents.setWindowOpenHandler(({ url, frameName }) => {
		const source = contents.getURL();
		const artifact =
			frameName === 'tracker-artifact' &&
			gate.validate(source) &&
			/^\/tracker\/?$/.test(new URL(source).pathname) &&
			trackerArtifactUrlSchema.safeParse(url).success;
		if (artifact || gate.allowsTrackerTextLink(source, url, frameName))
			void shell.openExternal(url).catch(() => {});
		return { action: 'deny' };
	});
	contents.on('will-navigate', (event, url) => {
		if (!gate.validate(url)) event.preventDefault();
	});
	contents.on('will-attach-webview', (event) => event.preventDefault());
}
