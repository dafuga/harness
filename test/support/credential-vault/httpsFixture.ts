import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { expect } from 'vitest';
import {
	dockerControl,
	dockerDaemon
} from '../../../src/adapters/agents-providers/managed-provider-docker-adapter/dockerControl';

const context = process.env.HARNESS_TEST_VAULT_DOCKER_CONTEXT;

export async function withHttpsFixture(
	image: string,
	channel: 'sms' | 'email',
	use: (context: { id: string; ip: string; securityLog(): Promise<string> }) => Promise<void>,
	capture = false
) {
	const engine = await dockerDaemon(context);
	const docker = (args: string[]) => dockerControl(engine, args);
	const name = 'vault-jw0799-' + randomUUID();
	const label = `org.harness.vault-https-fixture=${name}`;
	const id = await docker(['network', 'create', '--internal', '--label', label, name]);
	const fixture = readFileSync('test/support/credential-vault/fixtureHttps.py', 'utf8');
	let site = '';
	try {
		site = await docker([
			'run',
			'-d',
			'--rm',
			'--pull=never',
			'--network=' + id,
			'--env=VAULT_FIXTURE_OTP=' + channel,
			...(capture ? ['--env=VAULT_CAPTURE=yes'] : []),
			'--label=' + label,
			'--entrypoint=/usr/bin/python3',
			image,
			'-c',
			fixture
		]);
		const format = '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}';
		const ip = await docker(['inspect', '--format', format, site]);
		await waitForHttps(docker, site);
		const readLog =
			'import ssl, urllib.request; print(urllib.request.urlopen("https://127.0.0.1/security-log", context=ssl._create_unverified_context()).read().decode())';
		await use({
			id,
			ip,
			securityLog: () => docker(['exec', site, '/usr/bin/python3', '-c', readLog])
		});
	} finally {
		if (site) await docker(['rm', '-f', site]);
		await docker(['network', 'rm', id]);
		expect(await docker(['ps', '-aq', '--filter', 'label=' + label])).toBe('');
		expect(await docker(['network', 'ls', '-q', '--filter', 'label=' + label])).toBe('');
	}
}

async function waitForHttps(
	docker: (args: string[]) => Promise<string>,
	site: string
): Promise<void> {
	const check = 'import socket; socket.create_connection(("127.0.0.1", 443), timeout=1).close()';
	for (let attempt = 0; attempt < 15; attempt++) {
		const ready = await docker(['exec', site, '/usr/bin/python3', '-c', check]).then(
			() => true,
			() => false
		);
		if (ready) return;
		await setTimeout(100);
	}
	throw new Error('Synthetic HTTPS fixture did not start.');
}
