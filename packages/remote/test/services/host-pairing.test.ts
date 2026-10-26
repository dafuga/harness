import { componentManifestSchema, type ComponentManifest } from '../../../../src/core/unitTypes';
import { test } from 'vitest';
import manifest from '../../../../specification/units/remote.service.host-pairing.json';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import { setup, reaches } from '../support/hostPairingCases';
import { checks } from '../support/hostPairingChecks';

// Admit JSON before narrowing its inferred heterogeneous object unions.
componentManifestSchema.parse(manifest);
new TestExpectationService().registerCases(
	test,
	manifest as unknown as ComponentManifest,
	'packages/remote/test/services/host-pairing.test.ts',
	{
		'open.initialized': async () =>
			checks.open(await reaches.initialized(await setup()), 'initialized'),
		'open.offered': async () => checks.open(await reaches.offered(await setup()), 'offered'),
		'open.requested': async () => checks.open(await reaches.requested(await setup()), 'requested'),
		'open.exhausted': async () => checks.open(await reaches.exhausted(await setup()), 'exhausted'),
		'open.expired': async () => checks.open(await reaches.expired(await setup()), 'expired'),
		'open.approved': async () => checks.open(await reaches.approved(await setup()), 'approved'),
		'open.denied': async () => checks.open(await reaches.denied(await setup()), 'denied'),
		'open.closed': async () => checks.open(await reaches.closed(await setup()), 'closed'),
		'offer.initialized': async () =>
			checks.offer(await reaches.initialized(await setup()), 'initialized'),
		'offer.offered': async () => checks.offer(await reaches.offered(await setup()), 'offered'),
		'offer.requested': async () =>
			checks.offer(await reaches.requested(await setup()), 'requested'),
		'offer.exhausted': async () =>
			checks.offer(await reaches.exhausted(await setup()), 'exhausted'),
		'offer.expired': async () => checks.offer(await reaches.expired(await setup()), 'expired'),
		'offer.approved': async () => checks.offer(await reaches.approved(await setup()), 'approved'),
		'offer.denied': async () => checks.offer(await reaches.denied(await setup()), 'denied'),
		'offer.closed': async () => checks.offer(await reaches.closed(await setup()), 'closed'),
		'requests.initialized': async () =>
			checks.requests(await reaches.initialized(await setup()), 'initialized'),
		'requests.offered': async () =>
			checks.requests(await reaches.offered(await setup()), 'offered'),
		'requests.requested': async () =>
			checks.requests(await reaches.requested(await setup()), 'requested'),
		'requests.exhausted': async () =>
			checks.requests(await reaches.exhausted(await setup()), 'exhausted'),
		'requests.expired': async () =>
			checks.requests(await reaches.expired(await setup()), 'expired'),
		'requests.approved': async () =>
			checks.requests(await reaches.approved(await setup()), 'approved'),
		'requests.denied': async () => checks.requests(await reaches.denied(await setup()), 'denied'),
		'requests.closed': async () => checks.requests(await reaches.closed(await setup()), 'closed'),
		'receive.initialized': async () =>
			checks.receive(await reaches.initialized(await setup()), 'initialized'),
		'receive.offered': async () => checks.receive(await reaches.offered(await setup()), 'offered'),
		'receive.requested': async () =>
			checks.receive(await reaches.requested(await setup()), 'requested'),
		'receive.exhausted': async () =>
			checks.receive(await reaches.exhausted(await setup()), 'exhausted'),
		'receive.expired': async () => checks.receive(await reaches.expired(await setup()), 'expired'),
		'receive.approved': async () =>
			checks.receive(await reaches.approved(await setup()), 'approved'),
		'receive.denied': async () => checks.receive(await reaches.denied(await setup()), 'denied'),
		'receive.closed': async () => checks.receive(await reaches.closed(await setup()), 'closed'),
		'approve.initialized': async () =>
			checks.approve(await reaches.initialized(await setup()), 'initialized'),
		'approve.offered': async () => checks.approve(await reaches.offered(await setup()), 'offered'),
		'approve.requested': async () =>
			checks.approve(await reaches.requested(await setup()), 'requested'),
		'approve.exhausted': async () =>
			checks.approve(await reaches.exhausted(await setup()), 'exhausted'),
		'approve.expired': async () => checks.approve(await reaches.expired(await setup()), 'expired'),
		'approve.approved': async () =>
			checks.approve(await reaches.approved(await setup()), 'approved'),
		'approve.denied': async () => checks.approve(await reaches.denied(await setup()), 'denied'),
		'approve.closed': async () => checks.approve(await reaches.closed(await setup()), 'closed'),
		'deny.initialized': async () =>
			checks.deny(await reaches.initialized(await setup()), 'initialized'),
		'deny.offered': async () => checks.deny(await reaches.offered(await setup()), 'offered'),
		'deny.requested': async () => checks.deny(await reaches.requested(await setup()), 'requested'),
		'deny.exhausted': async () => checks.deny(await reaches.exhausted(await setup()), 'exhausted'),
		'deny.expired': async () => checks.deny(await reaches.expired(await setup()), 'expired'),
		'deny.approved': async () => checks.deny(await reaches.approved(await setup()), 'approved'),
		'deny.denied': async () => checks.deny(await reaches.denied(await setup()), 'denied'),
		'deny.closed': async () => checks.deny(await reaches.closed(await setup()), 'closed'),
		'close.initialized': async () =>
			checks.close(await reaches.initialized(await setup()), 'initialized'),
		'close.offered': async () => checks.close(await reaches.offered(await setup()), 'offered'),
		'close.requested': async () =>
			checks.close(await reaches.requested(await setup()), 'requested'),
		'close.exhausted': async () =>
			checks.close(await reaches.exhausted(await setup()), 'exhausted'),
		'close.expired': async () => checks.close(await reaches.expired(await setup()), 'expired'),
		'close.approved': async () => checks.close(await reaches.approved(await setup()), 'approved'),
		'close.denied': async () => checks.close(await reaches.denied(await setup()), 'denied'),
		'close.closed': async () => checks.close(await reaches.closed(await setup()), 'closed')
	}
);
