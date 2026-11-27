// @harness-uid u_qwcok2ny3o
import { HygieneError } from './HygieneError';
import { basename } from 'node:path';
import {
	containerIdPattern,
	requireWorkspaceImage,
	dockerControl,
	dockerDaemon,
	requireDaemon
} from '../../../adapters/agents-providers/managed-provider-docker-adapter/dockerControl';
import { beginResource, markResource } from './hygieneLedger';

const label = 'org.harness.tracker-run-resource';

export async function openHygieneContainer([image, ...command]: string[]) {
	if (!image || !/^sha256:[a-f0-9]{64}$/.test(image))
		throw new HygieneError('Use the full image ID of a local Docker image.');
	const daemon = await dockerDaemon();
	await requireWorkspaceImage(daemon, image);
	const entry = beginResource({ kind: 'container', host: daemon.host, daemon: daemon.id });
	await requireDaemon(daemon);
	const id = await dockerControl(daemon, [
		'create',
		'--pull=never',
		'--network=none',
		'--label',
		label + '=' + basename(entry),
		image,
		...command
	]);
	if (!containerIdPattern.test(id)) throw new HygieneError('Docker did not confirm creation.');
	try {
		await requireDaemon(daemon);
		await dockerControl(daemon, ['start', id]);
		return { resource: basename(entry), id };
	} finally {
		markResource(entry, 'ready');
	}
}

export async function closeHygieneContainer(entry: string, host: string, id: string) {
	const daemon = { host, id, env: { PATH: process.env.PATH, HOME: process.env.HOME } };
	const owner = basename(entry);
	await requireDaemon(daemon);
	const list = () =>
		dockerControl(daemon, [
			'ps',
			'--all',
			'--quiet',
			'--no-trunc',
			'--filter',
			'label=' + label + '=' + owner
		]);
	for (const container of (await list()).split('\n').filter(Boolean)) {
		if (!containerIdPattern.test(container))
			throw new HygieneError('Docker returned an invalid container identity.');
		await requireDaemon(daemon);
		// The immutable container ID and its creation label both have to match.
		const actual = await dockerControl(daemon, [
			'inspect',
			'--type=container',
			'--format',
			'{{index .Config.Labels "' + label + '"}}',
			container
		]);
		if (actual !== owner) throw new HygieneError('Docker container ownership changed.');
		await dockerControl(daemon, ['rm', '--force', '--volumes', container]).catch(() => undefined);
	}
	await requireDaemon(daemon);
	if (await list()) throw new HygieneError('Docker still lists a run-owned container.');
}
