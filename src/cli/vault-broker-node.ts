import { waitForCredentialBroker } from '../workflows/accounts-access/serveCredentialBroker';
import type { CredentialBrokerOptions } from '../workflows/accounts-access/serveCredentialBroker.types';

try {
	const options = JSON.parse(process.argv[2] ?? '') as CredentialBrokerOptions;
	await waitForCredentialBroker(options);
} catch {
	console.error('Vault broker could not run with the supplied state, trust and peer paths.');
	process.exitCode = 1;
}
