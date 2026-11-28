// @harness-uid u_sbwb4oz6di
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { reportsEnvironment } from '../src/cli/program/run-report/reportsEnvironment';
import { R2EvidenceStoreAdapter } from '../packages/reports/src/adapters/R2EvidenceStoreAdapter';
import {
	featureDeliveryId,
	featureDeliveryStage
} from '../src/core/projects-sessions/featureDelivery';
import { deliverFeature } from './deliver-feature/deliverFeature';
import { recordDelivery } from './deliver-feature/recordDelivery';
import { trackerDeliveryClient } from './deliver-feature/trackerDeliveryClient';
import { ExpectedCliError } from '../src/core/errors';

function deliveryOrigin() {
	const value = process.env.HARNESS_HUB_ORIGIN;
	if (!value) throw new ExpectedCliError('HARNESS_HUB_ORIGIN must name the published Hub origin');
	const url = new URL(value);
	if (url.protocol !== 'https:' || url.origin !== value.replace(/\/$/, ''))
		throw new ExpectedCliError('HARNESS_HUB_ORIGIN must be an HTTPS origin');
	return url.origin;
}

async function main() {
	const args = process.argv.slice(2);
	const divider = args.indexOf('--');
	if (divider < 0 || divider === args.length - 1)
		throw new ExpectedCliError(
			'Usage: deliver-feature <item> <dev|staging|live> [--note text] [--attach|--backfill-at date] -- <capture command>'
		);
	const { positionals, values } = parseArgs({
		args: args.slice(0, divider),
		allowPositionals: true,
		options: {
			note: { type: 'string' },
			attach: { type: 'boolean' },
			'backfill-at': { type: 'string' }
		}
	});
	const [id, stage] = positionals;
	const date = values['backfill-at'];
	if (positionals.length !== 2 || (values.attach && date))
		throw new ExpectedCliError('Specify one item, one stage and at most one attachment mode');
	if (!values.attach && !date && !values.note?.trim())
		throw new ExpectedCliError('Supply the delivery completion evidence with --note');
	const storage = evidenceStore();
	const result = await deliverFeature(
		{
			id: featureDeliveryId.parse(id),
			stage: featureDeliveryStage.parse(stage),
			origin: deliveryOrigin(),
			note: values.note?.trim() ?? '',
			attach: values.attach,
			backfillAt: date
				? new Date(z.iso.datetime({ offset: true }).parse(date)).toISOString()
				: undefined
		},
		{
			...trackerDeliveryClient,
			capture: () => recordDelivery(args.slice(divider + 1)),
			storeVideo: (delivery, bytes) =>
				storage.putFeatureVideo(delivery, bytes).catch(() => {
					throw new ExpectedCliError('Could not upload the feature video to Reports R2');
				}),
			publish: (delivery) =>
				storage.putFeatureReceipt(delivery).catch(() => {
					throw new ExpectedCliError(
						'Tracker delivery was recorded but could not be published to the Hub'
					);
				}),
			now: () => new Date()
		}
	);
	console.log(`Feature video: ${result.url}`);
}

function evidenceStore() {
	try {
		const { PROJECT_REPORTS_CONFIG_FILE } = reportsEnvironment();
		if (PROJECT_REPORTS_CONFIG_FILE)
			process.env.PROJECT_REPORTS_CONFIG_FILE = PROJECT_REPORTS_CONFIG_FILE;
		const storage = R2EvidenceStoreAdapter.fromEnvironment();
		if (storage) return storage;
	} catch {
		// The contents of credential configuration and SDK errors must stay out of the CLI.
	}
	throw new ExpectedCliError('The private Reports R2 evidence store is unavailable');
}

if (import.meta.main) {
	try {
		await main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : 'Feature delivery failed');
		process.exitCode = 1;
	}
}
