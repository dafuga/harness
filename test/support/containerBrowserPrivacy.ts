import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { ContainerBrowserAdapter } from '../../src/adapters/execution-runtimes/ContainerBrowserAdapter';
import { ContainerCdpAdapter } from '../../src/adapters/execution-runtimes/ContainerCdpAdapter';
import type { ContainerPageTarget } from '../../src/adapters/execution-runtimes/ContainerCdpAdapter.types';
import {
	browserEndpoint,
	dockerHost
} from '../../src/adapters/execution-runtimes/container-browser-adapter/dockerHost';
import { PrivateBrowserGateService } from '../../src/services/execution-runtimes/PrivateBrowserGateService';
import { containerBrowserSources } from '../../src/workflows/execution-runtimes/run-container-browser/containerBrowserPaths';

const socket = fixtureSocket();
const config = mkdtempSync(join(tmpdir(), 'harness-private-docker-'));
const profile = `private-e2e-${randomUUID().slice(0, 12)}`;
const container = `harness-browser-${profile}`;
const docker = dockerHost({ socket, config });
const browser = new ContainerBrowserAdapter({ profile }, docker);
const cdp = new ContainerCdpAdapter(browser);
const canary = 'synthetic-input-only';

try {
	await confirmFixtureEngine();
	await runFixture();
} finally {
	rmSync(config, { recursive: true, force: true });
}

async function runFixture(): Promise<void> {
	try {
		await browser.up(containerBrowserSources().seccomp);
		const ordinary = await mainTab();
		const proof = await exercisePrivacy(ordinary);
		const logs = await docker.docker(['logs', container]);
		console.log(JSON.stringify({ ...proof, logCanary: logs.includes(canary) }));
	} finally {
		await browser.remove();
		const volume = `${container}-profile`;
		const found = await docker.docker(['volume', 'ls', '--format', '{{.Name}}']);
		if (found.split('\n').includes(volume)) await docker.docker(['volume', 'rm', volume]);
	}
}

function fixtureSocket(): string {
	const requested = process.env.HARNESS_TEST_PRIVATE_BROWSER_SOCKET;
	const live = browserEndpoint().socket;
	if (!requested || !isAbsolute(requested))
		throw new Error('Set an isolated browser engine socket.');
	const socket = realpathSync(requested);
	if (!statSync(socket).isSocket() || (existsSync(live) && realpathSync(live) === socket)) {
		throw new Error('The private browser fixture requires a separate Unix engine socket.');
	}
	return socket;
}

async function confirmFixtureEngine(): Promise<void> {
	const limits = await docker.docker(['info', '--format', '{{.NCPU}} {{.MemTotal}}']);
	const [cpus, memory] = limits.split(/\s+/u).map(Number);
	if (!(cpus > 0 && cpus <= 2 && memory > 0 && memory <= 4 * 1024 ** 3)) {
		throw new Error('The private browser fixture engine must be capped at two CPUs and four GiB.');
	}
	const active = await docker.docker(['ps', '--format', '{{.Names}}']);
	if (active) throw new Error('The private browser fixture engine is already in use.');
}

async function mainTab(): Promise<ContainerPageTarget> {
	for (let attempt = 0; attempt < 40; attempt++) {
		const [target] = await cdp.pages().catch(() => []);
		if (target) return target;
		await Bun.sleep(250);
	}
	throw new Error('The disposable browser did not start.');
}

async function openBlankFixtureTab(): Promise<string> {
	const request =
		'PUT /json/new?about:blank HTTP/1.1\r\nHost: 127.0.0.1:9222\r\nConnection: close\r\n\r\n';
	return docker.docker([
		'exec',
		container,
		'sh',
		'-c',
		'printf "%s" "$1" | socat - TCP:127.0.0.1:9222',
		'fixture',
		request
	]);
}

async function exercisePrivacy(ordinary: ContainerPageTarget) {
	const device = 'paired-fixture';
	const ordinaryPage = await cdp.attach(ordinary);
	let formId: string | undefined;
	const gate = new PrivateBrowserGateService({
		revokeInput: async () => undefined,
		disposeForm: async () => {
			if (!formId) return;
			await cdp.closePage(formId);
		},
		verifyResult: async () => (await ordinaryPage.evaluate('document.body.dataset.result')) === 'ok'
	});
	try {
		await gate.recover();
		const before = await gate.read(() => ordinaryPage.evaluate('document.title'));
		const admitted = await gate.request(device);
		if (!admitted) throw new Error('The private fixture was not admitted.');
		await openBlankFixtureTab();
		const target = (await cdp.pages()).find(({ id }) => id !== ordinary.id);
		if (!target) throw new Error('The private tab did not open.');
		formId = target.id;
		const page = await cdp.attach(target);
		const proof = await submitFixture(gate, {
			page,
			ordinaryPage,
			requestId: admitted.requestId,
			device
		});
		return { before, ...proof, tabClosed: !(await cdp.pages()).some(({ id }) => id === formId) };
	} finally {
		ordinaryPage.close();
	}
}

async function submitFixture(
	gate: PrivateBrowserGateService,
	{
		page,
		ordinaryPage,
		requestId,
		device
	}: {
		page: Awaited<ReturnType<ContainerCdpAdapter['attach']>>;
		ordinaryPage: Awaited<ReturnType<ContainerCdpAdapter['attach']>>;
		requestId: string;
		device: string;
	}
) {
	let readExecuted = false;
	const accepted = await gate.nativeInput(requestId, device, async () => {
		try {
			await page.evaluate('document.body.innerHTML = "<input type=password>"');
			await page.evaluate(`document.querySelector('input').value = ${JSON.stringify(canary)}`);
			const result = await gate.read(() => {
				readExecuted = true;
				return page.evaluate("document.querySelector('input').value");
			});
			if (result !== undefined) throw new Error('An ordinary read escaped the private gate.');
			await ordinaryPage.evaluate("document.body.dataset.result = 'ok'");
		} finally {
			page.close();
		}
	});
	return {
		accepted,
		readExecuted,
		after: await gate.read(() => ordinaryPage.evaluate('document.body.dataset.result'))
	};
}
