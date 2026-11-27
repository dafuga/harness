import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createTempDirectory } from '../temporary';

const releasesPath = '.local/state/tracker/harness-releases';
const script = resolve('scripts/tracker-release-copy.sh');
const support = resolve('test/support/release-copy');

/** A staged local release, fake remote computers and the real rsync between them. */
export async function releaseCopyFixture(hosts: string[] = ['mb2']) {
	const root = await createTempDirectory('release-copy-');
	// A random release id keeps every process match private to this fixture.
	const id = randomBytes(5).toString('hex');
	const home = (host: string) => join(root, 'hosts', host);
	const releaseDir = (host: string) => join(home(host), releasesPath, id);
	for (const host of ['local', ...hosts]) mkdirSync(join(home(host), 'bin'), { recursive: true });
	const bin = join(root, 'bin');
	mkdirSync(bin);
	copyFileSync(join(support, 'ssh'), join(bin, 'ssh'));
	copyFileSync(join(support, 'orphan.pl'), join(root, 'orphan.pl'));
	writeExecutable(join(bin, 'codesign'), '#!/bin/sh\nexit 0\n');
	stageRelease(releaseDir('local'));

	const receivers = () => releaseReceivers(id);

	return {
		id,
		releaseDir,
		receivers,
		dropNextConnection: () => writeFileSync(join(root, 'drop-next'), ''),
		hostTool: (host: string, name: string, body: string) =>
			writeExecutable(join(home(host), 'bin', name), body),
		run: (...args: string[]) =>
			spawnSync('bash', [script, ...args], {
				encoding: 'utf8',
				env: {
					...process.env,
					PATH: `${bin}:${process.env.PATH}`,
					HOME: home('local'),
					FAKE_SSH_ROOT: root,
					HARNESS_RELEASE_TIMEOUT: '4',
					HARNESS_RELEASE_RETRY_SECONDS: '0',
					HARNESS_RELEASE_SOAK_SECONDS: '0'
				}
			}),
		/** The dropped connection finally closes; wait for any receiver it left behind. */
		async closeDroppedConnection() {
			writeFileSync(join(root, 'close'), '');
			for (let wait = 0; wait < 100 && receivers().length > 0; wait++) await delay(100);
			await delay(500);
		},
		intact: (host: string) => checksumsPass(releaseDir(host)),
		stagingDirs: (host: string) =>
			readdirSync(join(home(host), releasesPath)).filter((name) => name !== id),
		receiverCommands: () => {
			const log = join(root, 'receivers.log');
			return existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
		},
		dispose() {
			for (const pid of receivers()) process.kill(pid, 'SIGKILL');
			rmSync(root, { recursive: true, force: true });
		}
	};
}

/** The rsync receivers still running for one fixture release. */
function releaseReceivers(id: string) {
	return execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' })
		.split('\n')
		.map((line) => line.trim().split(/\s+/))
		.filter((words) => /(^|\/)(open)?rsync$/.test(words[1] ?? '') && words[2] === '--server')
		.filter((words) => words.at(-1)?.includes(id))
		.map((words) => Number(words[0]));
}

function writeExecutable(path: string, body: string) {
	writeFileSync(path, body);
	chmodSync(path, 0o700);
}

function stageRelease(directory: string) {
	mkdirSync(directory, { recursive: true });
	const files: Record<string, Buffer> = {
		harness: Buffer.concat([Buffer.from('#!/bin/sh\nexit 0\n'), randomBytes(200_000)]),
		'tracker-shim.sh': readFileSync(resolve('scripts/tracker-shim.sh')),
		BUILD_COMMIT: Buffer.from('fixture\n')
	};
	const sums = Object.entries(files).map(([name, content]) => {
		writeFileSync(join(directory, name), content);
		chmodSync(join(directory, name), 0o700);
		return `${createHash('sha256').update(content).digest('hex')}  ${name}\n`;
	});
	writeFileSync(join(directory, 'SHA256SUMS'), sums.join(''));
}

function checksumsPass(directory: string) {
	return spawnSync('shasum', ['-a', '256', '-c', 'SHA256SUMS'], { cwd: directory }).status === 0;
}
