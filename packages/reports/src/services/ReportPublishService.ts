import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { ReportRepository } from '../repositories/ReportRepository';
import { R2EvidenceStoreAdapter } from '../adapters/R2EvidenceStoreAdapter';
import { reportPublication } from '../utils/reportPublication';
import { reportPublicationVerify } from '../utils/reportPublicationVerify';
import { reportPages } from '../utils/reportPages';
import { atomicJson } from '../utils/reportFiles';
export class ReportPublishService {
	constructor(
		private readonly repository = new ReportRepository(),
		private readonly storage = R2EvidenceStoreAdapter.fromEnvironment(),
		private readonly deploy = reportPages,
		private readonly verify = reportPublicationVerify
	) {}
	async publish(id: string) {
		if (!this.storage) throw new Error('Cloudflare R2 is required for report publication');
		const bundle = await reportPublication(this.repository, id);
		const pending = {
			run: id,
			digest: bundle.digest,
			revision: bundle.revision,
			publishedAt: new Date().toISOString(),
			state: 'pending',
			files: bundle.files.map(({ path, sha256 }) => ({ path, sha256 }))
		};
		const receiptPath = join(this.repository.root, 'publications', id + '.json');
		try {
			await atomicJson(receiptPath, pending);
			for (const file of bundle.files) await this.storage.putPublication(id, bundle.digest, file);
			const url = await this.deploy(bundle);
			await atomicJson(receiptPath, { ...pending, url });
			await this.verify(bundle, url);
			const receipt = { ...pending, state: 'verified', url };
			await atomicJson(receiptPath, receipt);
			return receipt;
		} finally {
			await rm(bundle.directory, { recursive: true, force: true });
		}
	}
}
