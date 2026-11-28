// @harness-uid u_fyf7e7kyi5
import type { WatchdogPane } from '../../services/projects-sessions/WatchdogPaneService.types';
import { TrackerHostProcessError } from './tracker-host-process-adapter/TrackerHostProcessError';
import { WatchdogPaneService } from '../../services/projects-sessions/WatchdogPaneService';
import { paneBackgroundWork } from '../../services/projects-sessions/watchdog-pane-service/paneBackgroundWork';
import type {
	TrackerTmuxAdapterConfig,
	TrackerTmuxClose,
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
	trackerTmuxPane,
	trackerTmuxSockets
} from './tracker-tmux-adapter/trackerTmuxPane';

import { trackerTmuxWindows } from './tracker-tmux-adapter/trackerTmuxWindows';
import {
	closePaneCandidate,
	closePaneNames,
	killUnchangedPane
} from './tracker-tmux-adapter/trackerTmuxClose';
import {
	sendTrackerTmuxNudge,
	trackerTmuxCwd
} from './tracker-tmux-adapter/verifyTrackerTmuxSubmission';

const noServer =
	/^(?:no server running on |no sessions|error connecting to .+ \(No such file or directory\))/i;
const unsafeInput = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const decisions = new WatchdogPaneService();
const shouldReadCwd = (names: RegExp, { pane }: TrackerTmuxPane) =>
	names === trackerSessionName || pane.name === 'cos';

function closableScreen(
	{ cli, force, keepBackground }: TrackerTmuxClose,
	pane: WatchdogPane
): boolean {
	if (keepBackground && (pane.screen === null || paneBackgroundWork(pane))) return false;
	return force === true || decisions.idlePrompt(pane) === cli;
}

/** Observe the legacy sockets without opening a tmux server, and send only after a fresh identity check. */
export class TrackerTmuxAdapter {
	private readonly executable: string;
	private readonly sockets: string[];

	constructor(config: TrackerTmuxAdapterConfig) {
		this.executable = controlledTrackerExecutable(config.executable);
		this.sockets = trackerTmuxSockets(config.node);
	}

	async scan(signal: AbortSignal, names: RegExp = trackerSessionName): Promise<WatchdogPane[]> {
		const layouts = await this.layouts(signal, names);
		const captured = [];
		for (const [index, layout] of layouts.entries())
			captured.push(
				index < 100 ? await this.capture(layout, signal, shouldReadCwd(names, layout)) : layout
			);
		return captured.map(({ pane }) => pane);
	}

	async inventory(signal: AbortSignal): Promise<WatchdogPane[]> {
		return (await this.layouts(signal, trackerSessionName)).map(({ pane }) => pane);
	}

	/** Read the screen of one inventoried pane; it stays null if the pane changed or is unreadable. */
	async captured(pane: WatchdogPane, signal: AbortSignal): Promise<WatchdogPane> {
		const layout = (await this.layouts(signal, trackerSessionName)).find(
			({ pane: current }) => current.key === pane.key && current.name === pane.name
		);
		return layout ? (await this.capture(layout, signal)).pane : pane;
	}

	windows(signal: AbortSignal) {
		return trackerTmuxWindows(this.sockets, (socket, args) => this.command(socket, args, signal));
	}

	async nudge(input: TrackerTmuxNudge, signal: AbortSignal): Promise<boolean> {
		const { pane, cli, message } = input;
		if (!message || message.length > 5000 || unsafeInput.test(message)) return false;
		const names = input.names ?? (pane.name === 'cos' ? /^cos$/ : trackerSessionName);
		const candidate = (await this.layouts(signal, names)).find(
			({ pane: observed }) => observed.name === pane.name && matchesTrackerTmuxPane(observed, pane)
		);
		if (!candidate) return false;
		const observed = await this.capture(candidate, signal);
		if (decisions.idlePrompt(observed.pane) !== cli) return false;
		return sendTrackerTmuxNudge(
			input,
			observed,
			{
				command: (args) => this.command(observed.socket, args, signal),
				capture: async () => {
					const current = (await this.layouts(signal, names)).find(
						(entry) =>
							entry.pane.key === pane.key && entry.pane.name === pane.name && entry.pane.ready
					);
					return current && this.capture(current, signal);
				}
			},
			signal
		);
	}

	/** Close an unattended owned run only while the same single pane is idle or abandoned. */
	async closeIdle(input: TrackerTmuxClose, signal: AbortSignal): Promise<boolean> {
		const { attempt, stillComplete } = input;
		const names = closePaneNames(input);
		if (!names) return false;
		const candidate = closePaneCandidate(input, await this.layouts(signal, names));
		if (!candidate) return false;
		const observed = await this.capture(candidate, signal);
		if (!closableScreen(input, observed.pane) || !stillComplete()) return false;
		return killUnchangedPane(observed, attempt, (args) =>
			this.command(observed.socket, args, signal)
		);
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
				const layout = trackerTmuxPane(raw, { socket, primarySocket: index === 0, names });
				if (layout) layouts.push(layout);
			}
		}
		return layouts;
	}

	private async capture(
		layout: TrackerTmuxPane,
		signal: AbortSignal,
		withCwd = false
	): Promise<TrackerTmuxPane> {
		const { socket, id, raw, pane } = layout;
		if (!pane.readable) return layout;
		const screen = await this.command(socket, ['capture-pane', '-ep', '-t', id], signal);
		if (screen.code !== 0 || screen.stdout.length > 64_000) return layout;
		const identity = await this.command(
			socket,
			['display-message', '-p', '-t', id, trackerPaneFormat],
			signal
		);
		if (identity.code !== 0 || identity.stdout.trimEnd() !== raw) return layout;
		const cwd = withCwd
			? await trackerTmuxCwd(id, (args) => this.command(socket, args, signal))
			: undefined;
		return { ...layout, pane: { ...pane, screen: screen.stdout, cwd } };
	}

	private command(socket: string, args: string[], signal: AbortSignal) {
		return runTrackerHostCommand(this.executable, ['-L', socket, ...args], signal);
	}
}
