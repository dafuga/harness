import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { expect, test } from 'vitest';
import { ContainerBrowserAdapter } from '../../../src/adapters/execution-runtimes/ContainerBrowserAdapter';
import {
	colimaStartArgs,
	ensureColima
} from '../../../src/adapters/execution-runtimes/container-browser-adapter/colimaRuntime';
import {
	browserEndpoint,
	dockerHost
} from '../../../src/adapters/execution-runtimes/container-browser-adapter/dockerHost';
import { withTempDir } from '../../support/temporary';
import { containerBrowserArgs } from '../../../src/adapters/execution-runtimes/container-browser-adapter/containerBrowserArgs';

function host(listing: string[]) {
	const calls: string[][] = [];
	const streams: string[][] = [];
	return {
		calls,
		streams,
		docker: async (args: readonly string[]) => {
			calls.push([...args]);
			return args[0] === 'ps' ? (listing.shift() ?? '') : '';
		},
		stream: (args: readonly string[]) => {
			streams.push([...args]);
			return new PassThrough();
		}
	};
}

test('the browser container is capped, confined and publishes no port', () => {
	const args = containerBrowserArgs({ profile: 'x' }, '/repo/seccomp.json');
	expect(args).toEqual(
		expect.arrayContaining([
			'--cpus=2',
			'--memory=3g',
			'--cap-drop=ALL',
			'--security-opt=no-new-privileges',
			'--security-opt=seccomp=/repo/seccomp.json',
			'--mount=type=volume,source=harness-browser-x-profile,target=/profile'
		])
	);
	expect(args.join(' ')).not.toMatch(/--publish|(^| )-p |--network|privileged|type=bind/u);
	expect(() => containerBrowserArgs({ profile: '../x' }, '/s')).toThrow('profile name');
	expect(() => containerBrowserArgs({ profile: 'x', screen: '1;rm' }, '/s')).toThrow('screen');
});

test('up creates once, restarts a stopped browser and leaves a running one alone', async () => {
	const created = host(['', 'harness-browser-x\trunning\timg']);
	await new ContainerBrowserAdapter({ profile: 'x' }, created).up('/s.json');
	expect(created.calls[1][0]).toBe('run');
	const stopped = host(['harness-browser-x\texited\timg', 'harness-browser-x\trunning\timg']);
	await new ContainerBrowserAdapter({ profile: 'x' }, stopped).up('/s.json');
	expect(stopped.calls[1]).toEqual(['start', 'harness-browser-x']);
	const running = host(['harness-browser-x\trunning\timg']);
	await expect(
		new ContainerBrowserAdapter({ profile: 'x' }, running).up('/s.json')
	).resolves.toMatchObject({ running: true });
	expect(running.calls).toHaveLength(1);
});

test('removal stops before removing and keeps the profile volume', async () => {
	const fake = host(['harness-browser-x\trunning\timg']);
	await new ContainerBrowserAdapter({ profile: 'x' }, fake).remove();
	expect(fake.calls.slice(1).map((args) => args[0])).toEqual(['stop', 'rm']);
	expect(fake.calls.flat()).not.toContain('volume');
});

test('screen and DevTools are reached only through docker exec', () => {
	const fake = host([]);
	const browser = new ContainerBrowserAdapter({ profile: 'x' }, fake);
	browser.pipe('screen').destroy();
	browser.pipe('devtools').destroy();
	expect(fake.streams.map((args) => args.join(' '))).toEqual([
		'exec -i harness-browser-x socat STDIO TCP:127.0.0.1:5900',
		'exec -i harness-browser-x socat STDIO TCP:127.0.0.1:9222'
	]);
});

test('the protected Chrome image has a separate profile and disables remote debugging', async () => {
	const image = new URL('../../../deploy/container-browser/', import.meta.url);
	const dockerfile = await readFile(new URL('Dockerfile', image), 'utf8');
	const entrypoint = await readFile(new URL('entrypoint.sh', image), 'utf8');
	expect(dockerfile).toContain('AS protected-chrome');
	expect(dockerfile).toContain('/etc/opt/chrome/policies/managed');
	expect(dockerfile.split('FROM desktop AS chromium')[0]).toContain(
		'protected-chrome-health.py /opt/browser/protected-chrome-health.py'
	);
	expect(dockerfile.split('FROM desktop AS chromium')[1]).not.toContain('protected-chrome-health');
	const policy = JSON.parse(await readFile(new URL('protected-chrome-policy.json', image), 'utf8'));
	expect(policy).toMatchObject({
		RemoteDebuggingAllowed: false,
		PasswordManagerEnabled: false,
		AutofillAddressEnabled: false,
		AutofillCreditCardEnabled: false,
		AutofillSettings: [
			{ url_pattern: '*', blocked_types: ['contact_info', 'payments', 'identity_docs'] }
		]
	});
	const protectedMode = entrypoint.match(/\n\s*protected-chrome\)([\s\S]*?);;/u)?.[1];
	expect(protectedMode).toContain('/profile/google-chrome');
	expect(protectedMode).toContain('google-chrome-stable');
	expect(protectedMode).not.toMatch(
		/--remote-debugging|--enable-automation|--headless|--no-sandbox/u
	);
});

test('the dedicated VM is small, mounts nothing and leaves the active context alone', async () => {
	expect(colimaStartArgs('/image.qcow2')).toEqual(
		expect.arrayContaining(['--cpus=2', '--memory=4', '--mount=none', '--activate=false'])
	);
	const calls: string[][] = [];
	await ensureColima({ execute: async (args) => void calls.push(args) });
	expect(calls).toEqual([['status', 'harness-browser']]);
	await expect(
		ensureColima({ execute: async () => Promise.reject(new Error('down')) })
	).rejects.toThrow('colima start harness-browser');
});

test('docker runs against the dedicated socket with a config holding no credentials', async () => {
	const endpoint = browserEndpoint('/home/someone');
	expect(endpoint.socket).toBe('/home/someone/.colima/harness-browser/docker.sock');
	await withTempDir('docker-config-', async (directory) => {
		const config = join(directory, 'docker');
		const host = dockerHost({ socket: join(directory, 'absent.sock'), config });
		await expect(host.docker(['version'])).rejects.toThrow('docker version failed');
		const written = await readFile(join(config, 'config.json'), 'utf8');
		expect(written).toContain('cliPluginsExtraDirs');
		expect(written).not.toMatch(/credsStore|auths/u);
	});
});
