import type { TrackerProcessRow, Tree } from './groupTrackerProcesses.types';
// @harness-uid u_bpxxjlm3vz
import { basename } from 'node:path';
import type { TrackerAgentKind, TrackerProcessGroup } from './trackerMachine.types';

const testRunner =
	/(?:^|[\s/])(?:vitest|jest|mocha|ava|tap)(?:\.js|\.mjs|\.cjs)?(?:\s|$)|\s--test(?:\s|=|$)|(?:^|[\s/])bun\s+test(?:\s|$)|playwright(?:\.js)?\s+test|npm-cli\.js\s+(?:run\s+)?test|(?:^|[\s/])(?:npm|pnpm|yarn)\s+(?:run\s+)?test(?:\s|$)/;
const browserName =
	/^(chrome|chromium|chrome-headless-shell|headless_shell|google chrome( helper.*)?|chromium( helper.*)?|firefox|webkitwebprocess|minibrowser|pw_run\.sh)$/i;
/** The native Claude Code install runs a binary named after its version. */
const versionedClaude = /^\S*\/claude\/versions\/\d+\.\d+\.\d+(?:\s|$)/;
const scriptHost = /^(node|bun|deno|mainthread)$/;

/** `ps -axo pid=,ppid=,rss=,pcpu=,comm=`. On macOS comm is a full path that may contain spaces. */
export function parseTrackerProcesses(text: string): TrackerProcessRow[] {
	const rows: TrackerProcessRow[] = [];
	for (const line of text.split('\n')) {
		const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+([\d.,]+)\s+(.+?)\s*$/.exec(line);
		if (!match) continue;
		const [, pid, ppid, rss, cpu, name] = match;
		rows.push({
			pid: Number(pid),
			ppid: Number(ppid),
			rss: Number(rss),
			cpu: Number(cpu.replace(',', '.')),
			name: basename(name)
		});
	}
	return rows;
}

/** The agent-related kind of a process. Command lines are only matched, never returned. */
export function classifyTrackerProcess(name: string, args = ''): TrackerAgentKind | undefined {
	const lower = name.toLowerCase();
	if (lower === 'claude' || lower === 'codex') return lower;
	if (versionedClaude.test(args)) return 'claude';
	if (scriptHost.test(lower) && testRunner.test(args)) return 'test-runner';
	return browserName.test(lower) && /ms-playwright|playwright/.test(args) ? 'browser' : undefined;
}

/**
 * An agent session is a claude or codex process with everything under it. A test runner or
 * Playwright browser outside any session is its own group. tmux names label the groups.
 */
export function groupTrackerProcesses(
	rows: readonly TrackerProcessRow[],
	argsByPid: ReadonlyMap<number, string>,
	panes: ReadonlyMap<number, string>
): TrackerProcessGroup[] {
	const tree = processTree(rows, argsByPid);
	return rows.flatMap((row) => {
		const kind = tree.kinds.get(row.pid);
		if (!kind) return [];
		const parents = ancestors(tree, row);
		const covered = parents.some(({ pid }) => {
			const above = tree.kinds.get(pid);
			return above === 'claude' || above === 'codex' || above === kind;
		});
		if (covered) return [];
		const pane = [row, ...parents].map(({ pid }) => panes.get(pid)).find(Boolean);
		const label = pane ? `${kind} in tmux:${pane}` : `${kind} pid ${row.pid}`;
		return [{ kind, pid: row.pid, label: label.slice(0, 120), ...subtreeUsage(tree, row) }];
	});
}

function processTree(
	rows: readonly TrackerProcessRow[],
	argsByPid: ReadonlyMap<number, string>
): Tree {
	const tree: Tree = { byPid: new Map(), children: new Map(), kinds: new Map() };
	for (const row of rows) {
		tree.byPid.set(row.pid, row);
		const siblings = tree.children.get(row.ppid);
		if (siblings) siblings.push(row);
		else tree.children.set(row.ppid, [row]);
		const kind = classifyTrackerProcess(row.name, argsByPid.get(row.pid));
		if (kind) tree.kinds.set(row.pid, kind);
	}
	return tree;
}

function ancestors(tree: Tree, row: TrackerProcessRow): TrackerProcessRow[] {
	const found: TrackerProcessRow[] = [];
	const seen = new Set([row.pid]);
	let next = tree.byPid.get(row.ppid);
	while (next && !seen.has(next.pid)) {
		seen.add(next.pid);
		found.push(next);
		next = tree.byPid.get(next.ppid);
	}
	return found;
}

function subtreeUsage(tree: Tree, root: TrackerProcessRow) {
	const pending = [root];
	const seen = new Set<number>();
	let cpu = 0;
	let rss = 0;
	for (let row = pending.pop(); row; row = pending.pop()) {
		if (seen.has(row.pid)) continue;
		seen.add(row.pid);
		cpu += row.cpu;
		rss += row.rss;
		pending.push(...(tree.children.get(row.pid) ?? []));
	}
	return { procs: seen.size, cpu: Math.round(cpu * 10) / 10, rss_mb: Math.round(rss / 1024) };
}
