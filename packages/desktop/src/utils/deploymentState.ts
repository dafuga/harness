import { RepositoryArbiterService } from '../services/RepositoryArbiterService';
import type { DeploymentPlugin, DeploymentConfig } from '../models/Deployment.types';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { deploymentEnvironments } from '../models/Deployment.types';
import type { DeploymentReceipt } from '../models/Deployment.types';
import { gitRead } from './gitRead';
const receiptWrites = new RepositoryArbiterService();
const receipts = z.array(
	z.object({
		environment: z.enum(deploymentEnvironments),
		commit: z.string().regex(/^[a-f0-9]{40,64}$/),
		branch: z.string(),
		updatedAt: z.iso.datetime(),
		adapter: z.string(),
		deploymentId: z.string(),
		configuration: z.string().optional(),
		url: z.url()
	})
);
async function location(root: string) {
	const common = (await gitRead(root, ['rev-parse', '--git-common-dir'])).trim();
	return join(resolve(root, common), 'harness-deployments');
}
export async function deploymentState(root: string): Promise<DeploymentReceipt[]> {
	try {
		return receipts.parse(
			JSON.parse(await readFile(join(await location(root), 'receipts.json'), 'utf8'))
		);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
}
export async function saveDeployment(root: string, receipt: DeploymentReceipt) {
	const directory = await location(root);
	return receiptWrites.exclusive(directory, () => writeReceipt(root, receipt, directory));
}
async function writeReceipt(root: string, receipt: DeploymentReceipt, directory: string) {
	const current = await deploymentState(root);
	await mkdir(directory, { recursive: true });
	const temp = join(directory, randomUUID() + '.tmp');
	await writeFile(
		temp,
		JSON.stringify([
			...current.filter((item) => item.environment !== receipt.environment),
			receipt
		]),
		{ mode: 0o600 }
	);
	await rename(temp, join(directory, 'receipts.json'));
}

export async function deploymentStatus(root: string, plugin: DeploymentPlugin) {
	const receipts = await deploymentState(root);
	let config: DeploymentConfig | undefined;
	let reason = '';
	try {
		config = await plugin.discover(root);
	} catch {
		reason = 'Cloudflare configuration is unavailable or invalid.';
	}
	return deploymentEnvironments.map((environment) => ({
		environment,
		receipt: receipts.find((item) => item.environment === environment) ?? null,
		available: Boolean(config?.targets[environment]),
		reason:
			reason ||
			(config?.targets[environment]
				? 'Cloudflare target configured.'
				: 'Deployment target not configured.')
	}));
}
