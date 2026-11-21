// @harness-uid u_dakcgp2ade
import type {
	StartupDialog,
	WatchdogCli,
	WatchdogItem,
	WatchdogNote,
	WatchdogPane,
	WatchdogRun
} from './WatchdogPaneService.types';

export class WatchdogPaneService {
	startupPrompt(_pane: WatchdogPane): StartupDialog | null | undefined {
		return null;
	}
	idlePrompt(_pane: WatchdogPane): WatchdogCli | null {
		return null;
	}
	manualItem(_pane: WatchdogPane, _items: readonly WatchdogItem[]): WatchdogItem | undefined {
		return undefined;
	}
	isStopped(
		_pane: WatchdogPane,
		_notes: readonly WatchdogNote[],
		_host: string,
		_cli: WatchdogCli | null
	): boolean {
		return false;
	}
	matchesRun(_pane: WatchdogPane, _run: WatchdogRun): boolean {
		return false;
	}
}
