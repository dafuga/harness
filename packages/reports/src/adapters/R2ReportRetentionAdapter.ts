import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { R2EvidenceStoreAdapter } from './R2EvidenceStoreAdapter';
import { r2EvidenceConfig } from '../utils/r2EvidenceConfig';
import { safeId } from '../utils/reportFiles';
import { reportCloudPrefixes } from '../utils/reportRetention';
export class R2ReportRetentionAdapter extends R2EvidenceStoreAdapter {
	static override fromEnvironment() {
		const config = r2EvidenceConfig();
		return config ? new R2ReportRetentionAdapter(config) : undefined;
	}
	async purge(id: string, dryRun = false) {
		let deleted = 0;
		for (const prefix of reportCloudPrefixes) {
			const keys = (await this.list(prefix + safeId(id) + '/')).map((item) => item.Key!);
			deleted += keys.length;
			if (!dryRun) await this.remove(keys);
		}
		return deleted;
	}
	async orphans(known: Set<string>, cutoff: number, dryRun = false) {
		let deleted = 0;
		for (const prefix of reportCloudPrefixes) {
			const keys = (await this.list(prefix))
				.filter((item) => {
					const id = item.Key!.slice(prefix.length).split('/')[0];
					return (
						/^[a-zA-Z0-9_-]{1,100}$/.test(id) &&
						!known.has(id) &&
						Boolean(item.LastModified && item.LastModified.getTime() <= cutoff)
					);
				})
				.map((item) => item.Key!);
			deleted += keys.length;
			if (!dryRun) await this.remove(keys);
		}
		return deleted;
	}
	private async list(prefix: string) {
		const objects: { Key?: string; LastModified?: Date }[] = [];
		let token: string | undefined;
		do {
			const page = await this.client.send(
				new ListObjectsV2Command({
					Bucket: this.config.bucket,
					Prefix: prefix,
					ContinuationToken: token
				})
			);
			for (const item of page.Contents || []) {
				if (!item.Key?.startsWith(prefix)) throw new Error('Cloud object escaped report scope');
				objects.push(item);
			}
			if (page.IsTruncated && !page.NextContinuationToken)
				throw new Error('Incomplete cloud listing; retry cleanup');
			token = page.NextContinuationToken;
		} while (token);
		return objects;
	}
	private async remove(keys: string[]) {
		for (let offset = 0; offset < keys.length; offset += 1000) {
			const result = await this.client.send(
				new DeleteObjectsCommand({
					Bucket: this.config.bucket,
					Delete: {
						Objects: keys.slice(offset, offset + 1000).map((Key) => ({ Key })),
						Quiet: true
					}
				})
			);
			if (result.Errors?.length)
				throw new Error(
					`Cloud cleanup failed for ${result.Errors.length} objects; local report retained for retry`
				);
		}
	}
}
