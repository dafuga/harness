import {} from './harnessIcons';

/** Whether a click is one the application follows itself: plain, primary and not yet handled. */
export function plainClick(event: MouseEvent): boolean {
	const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
	return event.button === 0 && !modified && !event.defaultPrevented;
}

export { harnessShell } from '../../components/explorer-ui/harness-navbar/harnessShell';

export type {
	HarnessNavbarInput,
	HarnessTab,
	HarnessShellLink,
	HarnessShellCategory,
	HarnessShellRevision,
	HarnessShellView
} from './harnessShell.types';
