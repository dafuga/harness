// @harness-uid u_ffstupjra6
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { FeatureDelivery } from '../../../../../src/core/projects-sessions/featureDelivery.types';
import {
	featureDeliveryReceiptKey,
	featureDeliveryVideoKey
} from '../../../../../src/core/projects-sessions/featureDelivery';
import { safeId } from '../../utils/reports-media/reportFiles';
import { r2EvidenceConfig } from '../../utils/verification-evidence/r2EvidenceConfig';
import type { R2ScreenshotStoreAdapterConfig } from './R2ScreenshotStoreAdapter';
import { R2EvidenceStoreError } from './R2EvidenceStoreAdapter.types';

export function evidenceObjectKey(reportId: string, file: string) {
	if (!/^[a-f0-9]{64}\.(png|jpg|webp|wav|mp3|m4a|ogg)$/.test(file))
		throw new R2EvidenceStoreError('Invalid R2 evidence name');
	return `report-evidence/runs/${safeId(reportId)}/assets/${file}`;
}
export function replayObjectKey(reportId: string, file: string) {
	if (!/^[a-f0-9]{64}\.mp4$/.test(file)) throw new R2EvidenceStoreError('Invalid R2 replay name');
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
	async putFeatureVideo(delivery: FeatureDelivery, bytes: Buffer) {
		await this.write(featureDeliveryVideoKey(delivery.id, delivery.sha256), bytes, 'video/webm');
	}
	async putFeatureReceipt(delivery: FeatureDelivery) {
		await this.write(
			featureDeliveryReceiptKey(delivery),
			Buffer.from(JSON.stringify(delivery)),
			'application/json'
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
		if (!response.Body) throw new R2EvidenceStoreError('R2 evidence has no body');
		return Buffer.from(await response.Body.transformToByteArray());
	}
}
