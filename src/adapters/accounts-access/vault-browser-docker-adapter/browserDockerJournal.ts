// @harness-uid u_bjzxwihuau
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readdir, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { ProcessIdentityAdapter } from '../../../services/agents-providers/agent-activity-service/ProcessIdentityAdapter';
import type { DockerTaskDaemon } from '../../agents-providers/ManagedProviderDockerAdapter.types';
import {
	containerIdPattern,
	daemonIdPattern,
	dockerControl,
	dockerSocketPattern,
	requireDaemon
} from '../../agents-providers/managed-provider-docker-adapter/dockerControl';
import type { VaultDockerReceipt } from './browserDockerJournal.types';

export const vaultDockerLabel = 'org.harness.vault-browser-fixture';
export const vaultDockerImage = /^sha256:[a-f0-9]{64}$/u;
const names = /^[a-f0-9-]{36}\.json$/u;
export const receiptSchema = z.strictObject({
	owner: z.uuid(),
	image: z.string().regex(vaultDockerImage),
	pid: z.number().int().positive(),
	startedAt: z.string().min(1),
	host: z.string().regex(dockerSocketPattern),
	daemonId: z.string().regex(daemonIdPattern),
	container: z.string().regex(containerIdPattern).optional()
});

export async function privateJournal(directory: string): Promise<void> {
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const stat = await lstat(directory);
	if (!stat.isDirectory() || stat.uid !== process.getuid?.() || stat.mode & 0o077) {
		throw new ExpectedCliError('Vault Docker receipts need a private executor-owned directory.');
	}
}

export function newBrowserReceipt(daemon: DockerTaskDaemon, image: string): VaultDockerReceipt {
	const { startedAt } = new ProcessIdentityAdapter().find(process.pid);
	if (!startedAt) throw new ExpectedCliError('Could not establish Vault supervisor identity.');
	return {
		owner: randomUUID(),
		image,
		pid: process.pid,
		startedAt,
		host: daemon.host,
		daemonId: daemon.id
	};
}

export async function saveBrowserReceipt(
	directory: string,
	receipt: VaultDockerReceipt
): Promise<void> {
	const file = join(directory, receipt.owner + '.json');
	const pending = file + '.partial';
	const fd = await open(pending, 'wx', 0o600);
	try {
		try {
			await fd.writeFile(JSON.stringify(receipt));
			await fd.sync();
		} finally {
			await fd.close();
		}
		await rename(pending, file);
		const parent = await open(directory, 'r');
		try {
			await parent.sync();
		} finally {
			await parent.close();
		}
	} finally {
		await rm(pending, { force: true });
	}
}

export async function recoverBrowserFixtures(
	directory: string,
	daemon: DockerTaskDaemon
): Promise<void> {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (!entry.isFile() || !names.test(entry.name)) continue;
		const receipt = await readReceipt(join(directory, entry.name));
		if (
			!receipt ||
			entry.name !== receipt.owner + '.json' ||
			receipt.host !== daemon.host ||
			receipt.daemonId !== daemon.id ||
			!supervisorGone(receipt)
		)
			continue;
		await removeBrowserFixture(directory, daemon, receipt);
	}
}

async function readReceipt(path: string): Promise<VaultDockerReceipt | undefined> {
	try {
		const parsed = receiptSchema.safeParse(JSON.parse(await readFile(path, 'utf8')));
		return parsed.success ? parsed.data : undefined;
	} catch (error) {
		if (error instanceof SyntaxError || (error as { code?: string }).code === 'ENOENT')
			return undefined;
		throw error;
	}
}

export async function removeBrowserFixture(
	directory: string,
	daemon: DockerTaskDaemon,
	receipt: VaultDockerReceipt
): Promise<void> {
	await requireDaemon(daemon);
	const current = await browserFixtureIds(daemon, receipt.owner);
	if (current.length === 0 && !receipt.container) return;
	if (current.length) {
		const [id] = current;
		if (current.length !== 1 || (receipt.container && receipt.container !== id)) {
			throw new ExpectedCliError('Ambiguous Vault Docker fixture. Recovery receipt retained.');
		}
		const format = '{{.Id}} {{.Image}} {{index .Config.Labels "' + vaultDockerLabel + '"}}';
		const inspected = await dockerControl(daemon, ['container', 'inspect', '--format', format, id]);
		if (inspected !== `${id} ${receipt.image} ${receipt.owner}`) {
			throw new ExpectedCliError(
				'Vault Docker fixture owner or image changed. Recovery receipt retained.'
			);
		}
		await requireDaemon(daemon);
		await dockerControl(daemon, ['rm', '--force', '--volumes', id]);
	}
	await requireDaemon(daemon);
	if ((await browserFixtureIds(daemon, receipt.owner)).length) {
		throw new ExpectedCliError(
			'Vault Docker fixture removal could not be verified. Recovery receipt retained.'
		);
	}
	await rm(join(directory, receipt.owner + '.json'), { force: true });
}

function supervisorGone(receipt: VaultDockerReceipt): boolean {
	const prior = new ProcessIdentityAdapter().find(receipt.pid);
	if (prior.exists === true && prior.startedAt) return prior.startedAt !== receipt.startedAt;
	if (prior.exists !== false) return false;
	try {
		process.kill(receipt.pid, 0);
		return false;
	} catch (error) {
		return (error as { code?: string }).code === 'ESRCH';
	}
}

async function browserFixtureIds(daemon: DockerTaskDaemon, owner: string): Promise<string[]> {
	const output = await dockerControl(daemon, [
		'ps',
		'-aq',
		'--no-trunc',
		'--filter',
		`label=${vaultDockerLabel}=${owner}`
	]);
	const ids = output ? output.split('\n') : [];
	if (ids.some((id) => !containerIdPattern.test(id)))
		throw new ExpectedCliError('Invalid Vault Docker fixture list.');
	return ids;
}
