// @harness-uid u_dakcgp2ade
import type {
	StartupDialog,
	WatchdogCli,
	WatchdogItem,
	WatchdogNote,
	WatchdogPane,
	WatchdogRun
} from './WatchdogPaneService.types';

const escape = '\u001b';
const controls = new RegExp(escape + '\\[[0-9;:]*m', 'g');
const faint = new RegExp('^' + escape + '\\[(?:2|2;[0-9;]+)m');
const manualName = /^auto-([a-z0-9]{6,10})$/;
const busy =
	/\b(?:esc to (?:interrupt|cancel)|ctrl\+c to interrupt|queued messages?|waiting for (?:approval|permission)|usage limit|out of credits|credit balance is too low)\b/i;
const alertMenus = [
	{
		cli: 'codex',
		kind: 'sign-in',
		patterns: [/Choose how you want to use Codex\./, /Press enter to continue$/i]
	},
	{
		cli: 'claude',
		kind: 'sign-in',
		patterns: [/^\s*Select login method:/m, /Claude account with subscription|Anthropic Console/i]
	},
	{
		cli: 'claude',
		kind: 'API key confirmation',
		patterns: [
			/^\s*Detected a custom API key in your environment\s*$/m,
			/^\s*Do you want to use this API key\?/m,
			/Enter to confirm\s*·\s*Esc to cancel$/i
		]
	},
	{
		cli: 'claude',
		kind: 'permission mode confirmation',
		patterns: [
			/^\s*In Bypass Permissions mode, Claude Code will not ask for your approval\b/im,
			/Yes, I accept/i,
			/No, exit/i
		]
	},
	{
		cli: 'codex',
		kind: 'hook trust',
		patterns: [/Review hooks/i, /Trust all and continue/i, /Continue without trusting/i]
	},
	{
		cli: 'claude',
		kind: 'settings error',
		patterns: [/^\s*Settings Error\b/im, /(?:Continue without|Exit to fix)/i]
	}
] as const;

function folderTrustDialog(screen: string, mayConfirm: boolean): StartupDialog | null {
	if (
		/^\s*Folder access\s*$/m.test(screen) &&
		/^\s*Trust this folder\?/m.test(screen) &&
		/enter continue\s*·\s*esc back$/i.test(screen)
	) {
		const selected =
			/^\s*›\s+1\. Trust and continue\s*\n\s*2\. Back to Agent Command Center\s*$/mu.test(screen);
		return { cli: 'codex', kind: 'folder trust', confirmable: mayConfirm && selected };
	}
	if (
		/^\s*Accessing workspace:\s*$/m.test(screen) &&
		/^\s*Quick safety check:/m.test(screen) &&
		/Enter to confirm\s*·\s*Esc to cancel$/i.test(screen)
	) {
		const selected = /^\s*❯\s+No, exit\s*\n\s*Yes, I trust this folder\s*$/mu.test(screen);
		return { cli: 'claude', kind: 'folder trust', confirmable: mayConfirm && selected };
	}
	return null;
}

function composerProvider(lines: readonly string[], y: number): WatchdogCli | null {
	const input = lines[y] ?? '';
	if (
		/^›(?:\s|$)/u.test(input) &&
		!lines[y + 1]?.trim() &&
		lines
			.slice(y + 2)
			.some((line) =>
				/^\s*(?:[\w.:-]+(?: [\w-]+)? · (?:~\/|\/)|\d+%\s+(?:context )?left\b)/.test(line)
			)
	)
		return 'codex';
	return claudeComposer(lines, y, input) ? 'claude' : null;
}

function claudeComposer(lines: readonly string[], y: number, input: string): boolean {
	return (
		/^❯(?:\s|$)/u.test(input) &&
		/^─{8}/u.test(lines[y - 1] ?? '') &&
		/^─{8}/u.test(lines[y + 1] ?? '') &&
		/^\s*(?:[⏵⏸]+\s|\? for shortcuts\b)/u.test(lines[y + 2] ?? '')
	);
}

function promptHasDraft(original: string, plain: string): boolean {
	const tail = original
		.split(/[›❯]/u, 2)[1]
		?.replace(escape + '[0m', '')
		.trimStart();
	// A faint placeholder may look like text. A typed draft may sit at the same cursor.
	return plain.trim().length > 1 && !faint.test(tail ?? '');
}

function readyScreen(pane: WatchdogPane): string | null {
	return pane.ready && pane.readable && pane.live ? pane.screen : null;
}

export class WatchdogPaneService {
	/** Undefined means the capture was unavailable. Null means no startup dialog was present. */
	startupPrompt(pane: WatchdogPane): StartupDialog | null | undefined {
		if (!pane.live || !pane.readable || pane.screen === null) return undefined;
		const visible = pane.screen.replace(controls, '').trim();
		// A startup menu copied into the transcript above a composer is inert.
		if (
			/^\s*[›❯](?:\s|$).*\n\s*\n\s*(?:\? for shortcuts|[\w.-]+(?: [\w-]+)? · (?:~\/|\/))/mu.test(
				visible
			)
		)
			return null;
		const trust = folderTrustDialog(visible, pane.ready && !pane.attached && Boolean(pane.cwd));
		if (trust) return trust;
		const menu = alertMenus.find(({ patterns }) =>
			patterns.every((pattern) => pattern.test(visible))
		);
		return menu ? { cli: menu.cli, kind: menu.kind, confirmable: false } : null;
	}

	idlePrompt(pane: WatchdogPane): WatchdogCli | null {
		const { x, y } = pane;
		const screen = readyScreen(pane);
		if (screen === null || x !== 2 || !Number.isInteger(y) || y < 1 || this.startupPrompt(pane))
			return null;
		const lines = screen.split('\n');
		const plain = lines.map((line) => line.replace(controls, ''));
		if (
			busy.test(plain.slice(Math.max(0, y - 5)).join('\n')) ||
			promptHasDraft(lines[y] ?? '', plain[y] ?? '')
		)
			return null;
		return composerProvider(plain, y);
	}

	isManual(pane: WatchdogPane): boolean {
		return manualName.test(pane.name);
	}

	manualItem(pane: WatchdogPane, items: readonly WatchdogItem[]): WatchdogItem | undefined {
		const id = manualName.exec(pane.name)?.[1];
		if (!id) return undefined;
		const matching = items.filter((item) => !item.deleted && item.id.startsWith(id));
		return (
			matching.find((item) => item.id === id) ?? (matching.length === 1 ? matching[0] : undefined)
		);
	}

	isStopped(
		pane: WatchdogPane,
		notes: readonly WatchdogNote[],
		host: string,
		cli: WatchdogCli | null
	): boolean {
		if (!this.isManual(pane)) return false;
		const local = notes.filter((note) => note.node === host);
		const stop = local.findLast((note) => /^stopped:.*\bresume from\b/is.test(note.text));
		if (!stop || stop.at < pane.createdAt) return false;
		if (stop.at > pane.activity) return Boolean(cli);
		const legacyNudge = local.some(
			(note) =>
				/^watchdog nudge [12]\/2 sent /.test(note.text) &&
				note.text.includes(` sent to ${pane.name} on ${host}`) &&
				note.at >= pane.activity &&
				note.at < pane.activity + 1000
		);
		return legacyNudge && (cli !== null || this.blankCodexComposer(pane));
	}

	matchesRun(pane: WatchdogPane, run: WatchdogRun): boolean {
		return pane.live && pane.runnerSocket && pane.name === run.tmux;
	}

	private blankCodexComposer(pane: WatchdogPane): boolean {
		const screen = readyScreen(pane);
		if (screen === null || pane.currentCommand !== 'codex' || pane.x !== 2 || pane.y < 1)
			return false;
		const lines = screen.replace(controls, '').split('\n');
		return (
			!lines[pane.y]?.trim() &&
			!lines[pane.y + 1]?.trim() &&
			!busy.test(lines.slice(Math.max(0, pane.y - 5)).join('\n'))
		);
	}
}
