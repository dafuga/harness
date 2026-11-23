import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const SCRIPT = fileURLToPath(
	new URL('../../scripts/install_screenshot_retention.py', import.meta.url)
);
const LABEL = 'com.danielfugere.project-reports.screenshot-retention';
const PREFIX = 'Installed daily cloud/local report cleanup at 03:00 local time:';

// Runs the real main() via runpy and writes a JSON summary of its effects.
const DRIVER = `import json, plistlib, runpy, stat, sys
from pathlib import Path

module, summary_path = sys.argv[1], Path(sys.argv[2])
summary = {}
try:
    runpy.run_path(module, run_name="unit")["main"]()
except Exception as error:
    summary["error"] = {"type": type(error).__name__}
    if hasattr(error, "returncode"):
        summary["error"]["returncode"] = error.returncode
    else:
        summary["error"]["message"] = str(error)
plists = sorted((Path.home() / "Library" / "LaunchAgents").glob("*.plist"))
summary["plistCount"] = len(plists)
if plists:
    data = plistlib.loads(plists[0].read_bytes())
    summary["plist"] = {
        "label": data["Label"],
        "calendar": data["StartCalendarInterval"],
        "runAtLoad": data["RunAtLoad"],
        "mode": oct(stat.S_IMODE(plists[0].stat().st_mode)),
        "args": data["ProgramArguments"][-2:],
        "entrypointIsIndex": data["ProgramArguments"][1].endswith("src/index.ts"),
    }
summary_path.write_text(json.dumps(summary))
`;

const FAKE_TOOLS: Record<string, string> = {
	plutil: '[ "$FAIL" = plutil ] && exit 1\nexit 0',
	launchctl: 'echo "$1" >> "$CALLS"\n[ "$1" = "$FAIL" ] && exit 1\nexit 0'
};

type Options = { bun: boolean; fail?: string };
type Facts = {
	error?: { type: string; message?: string; returncode?: number };
	plistCount: number;
	plist?: {
		label: string;
		calendar: { Hour: number; Minute: number };
		runAtLoad: boolean;
		mode: string;
		args: string[];
		entrypointIsIndex: boolean;
	};
	calls: string[];
};
type Run = Facts & { stdout: string };

function writeExecutable(path: string, body: string): void {
	writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
}

// Installs into a temporary HOME with fake plutil, launchctl and (optionally) bun.
function runInstall(options: Options): Run {
	const root = mkdtempSync(join(tmpdir(), 'retention-install-'));
	try {
		const bin = join(root, 'bin');
		const callsPath = join(root, 'calls.log');
		const summaryPath = join(root, 'summary.json');
		const driverPath = join(root, 'driver.py');
		mkdirSync(bin);
		writeFileSync(callsPath, '');
		writeFileSync(driverPath, DRIVER);
		for (const [name, body] of Object.entries(FAKE_TOOLS)) {
			writeExecutable(join(bin, name), body);
		}
		if (options.bun) writeExecutable(join(bin, 'bun'), 'exit 0');
		const run = spawnSync('/usr/bin/python3', ['-I', driverPath, SCRIPT, summaryPath], {
			encoding: 'utf8',
			env: {
				HOME: join(root, 'home'),
				PATH: [bin, '/usr/bin', '/bin'].join(':'),
				CALLS: callsPath,
				FAIL: options.fail ?? 'none'
			}
		});
		const facts = JSON.parse(readFileSync(summaryPath, 'utf8')) as Facts;
		const calls = readFileSync(callsPath, 'utf8')
			.split('\n')
			.filter((line) => line !== '');
		return { ...facts, calls, stdout: run.stdout };
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

function view(run: Run): Facts & { installedMessage: boolean } {
	const { stdout, ...facts } = run;
	return { ...facts, installedMessage: stdout.startsWith(PREFIX) };
}

function meta(state: string) {
	return {
		unitId: 'reports.script.install-screenshot-retention',
		symbol: 'main',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Writes the 03:00 daily LaunchAgent and loads it', () => {
	const input = { bun: true };
	const run = runInstall(input);
	const output = view(run);
	expect(run.plist?.label).toBe(LABEL);
	expect(run.plist?.calendar).toEqual({ Hour: 3, Minute: 0 });
	expect(run.plist?.args).toEqual(['report', 'cleanup']);
	expect(run.plist?.entrypointIsIndex).toBe(true);
	expect(run.plist?.mode).toBe('0o600');
	expect(output.installedMessage).toBe(true);
	expect(run.calls).toEqual(['bootout', 'bootstrap', 'print']);
	recordExampleCases(meta('writes-the-03-00-daily-launchagent-and-loads-it'), [
		{ name: 'Bun on PATH and every launchctl call succeeds', input, output }
	]);
});

test('Stops before writing anything when Bun is missing', () => {
	const input = { bun: false };
	const run = runInstall(input);
	const output = view(run);
	expect(run.error?.type).toBe('RuntimeError');
	expect(run.error?.message).toBe('Bun is required to install report retention');
	expect(run.plistCount).toBe(0);
	expect(run.calls).toEqual([]);
	recordExampleCases(meta('stops-before-writing-anything-when-bun-is-missing'), [
		{ name: 'Bun is not on PATH', input, output }
	]);
});

test('Fails with CalledProcessError when bootstrap exits nonzero', () => {
	const input = { bun: true, fail: 'bootstrap' };
	const run = runInstall(input);
	const output = view(run);
	expect(run.error?.type).toBe('CalledProcessError');
	expect(run.error?.returncode).toBe(1);
	expect(run.calls).toEqual(['bootout', 'bootstrap']);
	recordExampleCases(meta('fails-with-calledprocesserror-when-bootstrap-exits-nonzero'), [
		{ name: 'launchctl bootstrap exits 1', input, output }
	]);
});

test('Ignores a failing bootout and still bootstraps', () => {
	const input = { bun: true, fail: 'bootout' };
	const run = runInstall(input);
	const output = view(run);
	expect(run.error).toBeUndefined();
	expect(output.installedMessage).toBe(true);
	expect(run.calls).toEqual(['bootout', 'bootstrap', 'print']);
	recordExampleCases(meta('ignores-a-failing-bootout-and-still-bootstraps'), [
		{ name: 'launchctl bootout exits 1 and is ignored', input, output }
	]);
});
