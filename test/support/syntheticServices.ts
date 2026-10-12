import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ServiceAuthority } from '../../src/utils/platformServices';
import { signalProcesses, type TrackedProcess } from '../../src/utils/processDescendants';

/**
 * TEST ONLY. Stand-ins for an OS-managed shared service and for the developer tools that vouch
 * for it. Nothing of Apple's is started: the service is a small program that writes down every
 * signal it is sent and retires by itself, signed ad hoc under a made-up identifier, inside a
 * made-up application that is signed the same way. What makes a handoff legitimate is checked
 * with the real tools against these made-up identities. Given a third argument, the program
 * creates that file once it handles signals: it is loaded then and runs its own code.
 */
const daemonSource = `
#include <fcntl.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
static const char *journal;
static void note(const char *text) {
	int file = open(journal, O_WRONLY | O_CREAT | O_APPEND, 0600);
	if (file >= 0) { write(file, text, strlen(text)); close(file); }
}
static void signalled(int number) { (void)number; note("signalled\\n"); }
int main(int count, char **arguments) {
	if (count < 3) return 2;
	journal = arguments[2];
	int every[] = { SIGTERM, SIGINT, SIGHUP, SIGQUIT, SIGUSR1, SIGUSR2 };
	for (unsigned index = 0; index < sizeof every / sizeof *every; index++) signal(every[index], signalled);
	if (count > 3) close(open(arguments[3], O_WRONLY | O_CREAT, 0600));
	for (int left = atoi(arguments[1]) * 10; left > 0; left--) usleep(100000);
	note("retired\\n");
	return 0;
}
`;
const serviceIdentifier = 'harness.synthetic.ibtoold';
const rootIdentifier = 'harness.synthetic.root';
const plist = (identifier: string) =>
	`<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n` +
	`\t<key>CFBundleIdentifier</key>\n\t<string>${identifier}</string>\n` +
	`\t<key>CFBundleExecutable</key>\n\t<string>Synthetic</string>\n` +
	`\t<key>CFBundlePackageType</key>\n\t<string>APPL</string>\n</dict>\n</plist>\n`;
const sign = (identifier: string, path: string) =>
	execFileSync('codesign', ['--force', '--sign', '-', '--identifier', identifier, path], {
		stdio: 'pipe'
	});

export interface SyntheticServices {
	home: string;
	/** The made-up developer tools, vouched for, with the vetted service inside. */
	authority: ServiceAuthority;
	service: string;
	/** The same program under the same name where nothing vouches for it. */
	lookAlike: string;
	/** A plain program of the command's own. */
	helper: string;
	/** An application like the vouched one whose service carries another identity. */
	other: ServiceAuthority;
	/** An application whose service path is only a link to the look-alike. */
	linked: ServiceAuthority;
}

/** An application with developer tools inside; its service is the given file or a link to one. */
function application(home: string, name: string, place: (target: string) => void) {
	const bundle = join(home, `${name}.app`);
	const root = join(bundle, 'Contents/Developer');
	mkdirSync(join(bundle, 'Contents/MacOS'), { recursive: true });
	mkdirSync(join(root, 'usr/bin'), { recursive: true });
	writeFileSync(join(bundle, 'Contents/Info.plist'), plist(rootIdentifier));
	copyFileSync(join(home, 'daemon'), join(bundle, 'Contents/MacOS/Synthetic'));
	place(join(root, 'usr/bin/ibtoold'));
	sign(rootIdentifier, bundle);
	return {
		root,
		rootCode: bundle,
		rootRequirement: `identifier "${rootIdentifier}"`,
		services: [{ path: 'usr/bin/ibtoold', requirement: `identifier "${serviceIdentifier}"` }]
	};
}

export function syntheticServices(): SyntheticServices {
	const home = realpathSync(mkdtempSync(join(tmpdir(), 'harness-services-')));
	const signedAs = (identifier: string) => (target: string) => {
		copyFileSync(join(home, 'daemon'), target);
		chmodSync(target, 0o755);
		sign(identifier, target);
	};
	writeFileSync(join(home, 'daemon.c'), daemonSource);
	execFileSync('xcrun', ['clang', join(home, 'daemon.c'), '-o', join(home, 'daemon')], {
		stdio: 'pipe'
	});
	const lookAlike = join(home, 'Lookalike/usr/bin/ibtoold');
	const helper = join(home, 'helper');
	mkdirSync(dirname(lookAlike), { recursive: true });
	signedAs(serviceIdentifier)(lookAlike);
	signedAs('harness.synthetic.helper')(helper);
	const authority = application(home, 'Synthetic', signedAs(serviceIdentifier));
	return {
		home,
		authority,
		service: join(authority.root, 'usr/bin/ibtoold'),
		lookAlike,
		helper,
		other: application(home, 'Other', signedAs('harness.synthetic.other')),
		linked: application(home, 'Linked', (target) => symlinkSync(lookAlike, target))
	};
}

const children: ChildProcess[] = [];
const strays: TrackedProcess[] = [];

/** The identity of a running process: its id with the time it started. */
export function identityOf(pid: number): TrackedProcess {
	const started = execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], { stdio: 'pipe' });
	return { pid, started: started.toString().trim() };
}

/** Whether exactly this process still runs. */
export function alive(known: TrackedProcess): boolean {
	try {
		return identityOf(known.pid).started === known.started;
	} catch {
		return false;
	}
}

/** A process the test itself starts and keeps as its child. */
export function child(file: string, args: string[], detached = false): TrackedProcess {
	const started = spawn(file, args, { detached, stdio: 'ignore' });
	children.push(started);
	return identityOf(started.pid!);
}

/** A process started through a parent that ends at once, so that launchd adopts it. */
export function adopted(file: string, args: string[]): TrackedProcess {
	const script =
		'const c = require("child_process").spawn(process.argv[1], process.argv.slice(2), ' +
		'{ detached: true, stdio: "ignore" }); c.unref(); console.log(c.pid);';
	const pid = Number(execFileSync(process.execPath, ['-e', script, file, ...args]).toString());
	return remembered(identityOf(pid));
}

/** Something a command under test started; it is ended with everything else at the end. */
export function remembered(known: TrackedProcess): TrackedProcess {
	strays.push(known);
	return known;
}

export const journal = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : '');
export const pause = (milliseconds: number) =>
	new Promise((done) => setTimeout(done, milliseconds));

/** Ends what these tests started, each by its identity, and removes what they wrote. */
export async function cleared(home: string): Promise<void> {
	for (const started of children) started.kill('SIGKILL');
	await signalProcesses(strays, 'SIGKILL');
	rmSync(home, { recursive: true, force: true });
}
