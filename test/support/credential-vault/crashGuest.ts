import { join } from 'node:path';
import { VaultBrowserDockerAdapter } from '../../../src/adapters/accounts-access/VaultBrowserDockerAdapter';

const image = process.env.HARNESS_TEST_VAULT_DOCKER_IMAGE ?? '';
const journal = process.argv[2];
const adapter = new VaultBrowserDockerAdapter({
	image,
	journal,
	context: process.env.HARNESS_TEST_VAULT_DOCKER_CONTEXT,
	seccomp: join(process.cwd(), 'deploy/vault/seccomp.json')
});
const guest = await adapter.launch({ origins: ['https://console.example.test'], redirects: [] });
process.stdout.write(guest.owner + '\n');
