// @harness-uid u_fyf7e7kyi5
import type { WatchdogPane } from '../../services/projects-sessions/WatchdogPaneService.types';
import { TrackerHostProcessError } from './tracker-host-process-adapter/TrackerHostProcessError';
import { WatchdogPaneService } from '../../services/projects-sessions/WatchdogPaneService';
import type {
	TrackerTmuxAdapterConfig,
	TrackerTmuxNudge,
	TrackerTmuxPane
} from './TrackerTmuxAdapter.types';
import {
	controlledTrackerExecutable,
	runTrackerHostCommand
} from './tracker-host-process-adapter/trackerHostCommand';
import {
	matchesTrackerTmuxPane,
	trackerPaneFormat,
	trackerSessionName,
	trackerTmuxKeys,
	trackerTmuxPane
} from './tracker-tmux-adapter/trackerTmuxPane';

const noServer =
	/^(?:no server running on |no sessions|error connecting to .+ \(No such file or directory\))/i;
const unsafeInput = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

/** Observe the legacy sockets without opening a tmux server, and send only after a fresh identity check. */
export class TrackerTmuxAdapter {
	private readonly executable: string;
	private readonly sockets: string[];
	private readonly decisions = new WatchdogPaneService();

	constructor(config: TrackerTmuxAdapterConfig) {
		const { executable, node } = config;
		this.executable = controlledTrackerExecutable(executable);
		this.sockets = node === 'harbor-mbp-2' ? ['claude', 'default'] : ['default'];
	}

	async scan(signal: AbortSignal, names: RegExp = trackerSessionName): Promise<WatchdogPane[]> {
		const layouts = await this.layouts(signal, names);
		const captured = [];
		for (const layout of layouts.slice(0, 100)) captured.push(await this.capture(layout, signal));
		return captured.map(({ pane }) => pane);
	}

	async inventory(signal: AbortSignal): Promise<WatchdogPane[]> {
		return (await this.layouts(signal, trackerSessionName)).map(({ pane }) => pane);
	}

	async nudge(input: TrackerTmuxNudge, signal: AbortSignal): Promise<boolean> {
		const { pane, cli, message } = input;
		if (!message || message.length > 5000 || unsafeInput.test(message)) return false;
		const names = pane.name === 'cos' ? /^cos$/ : trackerSessionName;
		const candidate = (await this.layouts(signal, names)).find(
			({ pane: observed }) => observed.name === pane.name && matchesTrackerTmuxPane(observed, pane)
		);
		if (!candidate) return false;
		const observed = await this.capture(candidate, signal);
		if (this.decisions.idlePrompt(observed.pane) !== cli) return false;
		const { socket, id, raw } = observed;
		const result = await this.command(
			socket,
			[
				'if-shell',
				'-F',
				'-t',
				id,
				`#{==:${trackerPaneFormat},${raw}}`,
				trackerTmuxKeys(id, message)
			],
			signal
		);
		return result.code === 0 && result.stdout.trim() === 'tracker-watchdog-sent';
	}

	private async layouts(signal: AbortSignal, names: RegExp): Promise<TrackerTmuxPane[]> {
		const layouts = [];
		for (const [index, socket] of this.sockets.entries()) {
			const result = await this.command(
				socket,
				['list-panes', '-a', '-F', trackerPaneFormat],
				signal
			);
			if (result.code !== 0 && noServer.test(result.stderr)) continue;
			if (result.code !== 0)
				throw new TrackerHostProcessError('Tracker tmux pane inventory failed');
			for (const raw of result.stdout.trimEnd().split('\n')) {
				const layout = trackerTmuxPane(raw, { socket, runnerSocket: index === 0, names });
				if (layout) layouts.push(layout);
			}
		}
		return layouts;
	}

	private async capture(layout: TrackerTmuxPane, signal: AbortSignal): Promise<TrackerTmuxPane> {
		const { socket, id, raw, pane } = layout;
		if (!pane.readable) return layout;
		const screen = await this.command(socket, ['capture-pane', '-ep', '-t', id], signal);
		if (screen.code !== 0 || screen.stdout.length > 64_000) return layout;
		const identity = await this.command(
			socket,
			['display-message', '-p', '-t', id, trackerPaneFormat],
			signal
		);
		return identity.code === 0 && identity.stdout.trimEnd() === raw
			? { ...layout, pane: { ...pane, screen: screen.stdout } }
			: layout;
	}

	private command(socket: string, args: string[], signal: AbortSignal) {
		return runTrackerHostCommand(this.executable, ['-L', socket, ...args], signal);
	}
}
