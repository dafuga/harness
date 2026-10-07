import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { safeId } from '../utils/reportFiles';
import { r2EvidenceConfig } from '../utils/r2EvidenceConfig';
import type { R2ScreenshotStoreAdapterConfig } from './R2ScreenshotStoreAdapter';

export function evidenceObjectKey(reportId: string, file: string) {
	if (!/^[a-f0-9]{64}\.(png|jpg|webp|wav|mp3|m4a|ogg)$/.test(file))
		throw new Error('Invalid R2 evidence name');
	return `report-evidence/runs/${safeId(reportId)}/assets/${file}`;
}
export function replayObjectKey(reportId: string, file: string) {
	if (!/^[a-f0-9]{64}\.mp4$/.test(file)) throw new Error('Invalid R2 replay name');
	return `report-evidence/runs/${safeId(reportId)}/replays/${file}`;
}
export class R2EvidenceStoreAdapter {
	protected readonly client: S3Client;
	constructor(
		protected readonly config: R2ScreenshotStoreAdapterConfig,
		client?: S3Client
	) {
		this.client =
			client ??
			new S3Client({
				region: 'auto',
				forcePathStyle: true,
				endpoint: config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`,
				credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
			});
	}
	static fromEnvironment() {
		const config = r2EvidenceConfig();
		return config ? new R2EvidenceStoreAdapter(config) : undefined;
	}
	async put(reportId: string, file: string, bytes: Buffer, mime: string) {
		await this.write(evidenceObjectKey(reportId, file), bytes, mime);
	}
	async get(reportId: string, file: string) {
		return this.read(evidenceObjectKey(reportId, file));
	}
	async putReplay(reportId: string, file: string, bytes: Buffer) {
		await this.write(replayObjectKey(reportId, file), bytes, 'video/mp4');
	}
	async getReplay(reportId: string, file: string) {
		return this.read(replayObjectKey(reportId, file));
	}
	async putPublication(
		reportId: string,
		version: string,
		file: { path: string; bytes: Buffer; mime: string }
	) {
		if (!/^[a-f0-9]{64}$/.test(version)) throw new Error('Invalid publication digest');
		if (
			!/^(index\.html|report\.pdf|report\.zip|assets\/[a-f0-9]{64}\.(png|jpg|webp|wav|mp3|m4a|ogg))$/.test(
				file.path
			)
		)
			throw new Error('Invalid publication file');
		await this.write(
			`published-reports/${safeId(reportId)}/${version}/${file.path}`,
			file.bytes,
			file.mime
		);
	}
	private async write(key: string, bytes: Buffer, mime: string) {
		await this.client.send(
			new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: bytes, ContentType: mime })
		);
	}
	private async read(key: string) {
		const response = await this.client.send(
			new GetObjectCommand({ Bucket: this.config.bucket, Key: key })
		);
		if (!response.Body) throw new Error('R2 evidence has no body');
		return Buffer.from(await response.Body.transformToByteArray());
	}
}
