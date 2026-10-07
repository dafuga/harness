import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { readFileSync } from 'node:fs';
import { safeId } from '../utils/reportFiles';

export interface R2ScreenshotStoreAdapterConfig {
	accountId: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	endpoint?: string;
}

export const screenshotObjectPrefix = 'uploaded-screenshots/';
const r2Keys = [
	'PROJECT_REPORTS_R2_ACCOUNT_ID',
	'PROJECT_REPORTS_R2_BUCKET',
	'PROJECT_REPORTS_R2_ACCESS_KEY_ID',
	'PROJECT_REPORTS_R2_SECRET_ACCESS_KEY'
] as const;

function readLocalR2Config(localFile?: string) {
	const local: Record<string, string> = {};
	if (!localFile) return local;
	let contents = '';
	try {
		contents = readFileSync(localFile, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	for (const line of contents.split(/\r?\n/)) {
		const match = line.match(/^(PROJECT_REPORTS_R2_[A-Z_]+)=(.*)$/);
		if (match && r2Keys.includes(match[1] as (typeof r2Keys)[number]))
			local[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
	}
	return local;
}

export function r2ScreenshotConfig(source: NodeJS.ProcessEnv, localFile?: string) {
	const local = readLocalR2Config(localFile);
	return {
		accountId: source.PROJECT_REPORTS_R2_ACCOUNT_ID || local.PROJECT_REPORTS_R2_ACCOUNT_ID || '',
		bucket: source.PROJECT_REPORTS_R2_BUCKET || local.PROJECT_REPORTS_R2_BUCKET || '',
		accessKeyId:
			source.PROJECT_REPORTS_R2_ACCESS_KEY_ID || local.PROJECT_REPORTS_R2_ACCESS_KEY_ID || '',
		secretAccessKey:
			source.PROJECT_REPORTS_R2_SECRET_ACCESS_KEY ||
			local.PROJECT_REPORTS_R2_SECRET_ACCESS_KEY ||
			'',
		endpoint: source.PROJECT_REPORTS_R2_ENDPOINT
	};
}

export function r2ObjectKey(reportId: string, file: string) {
	if (!/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(file)) throw new Error('Invalid R2 image name');
	return `${screenshotObjectPrefix}runs/${safeId(reportId)}/assets/${file}`;
}

export class R2ScreenshotStoreAdapter {
	private readonly client: S3Client;
	constructor(
		private readonly config: R2ScreenshotStoreAdapterConfig,
		client?: S3Client
	) {
		this.client =
			client ??
			new S3Client({
				region: 'auto',
				forcePathStyle: true,
				endpoint: config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`,
				credentials: {
					accessKeyId: config.accessKeyId,
					secretAccessKey: config.secretAccessKey
				}
			});
	}
	static fromEnvironment() {
		const config = r2ScreenshotConfig(
			process.env,
			process.env.NODE_ENV === 'test' ? undefined : process.env.PROJECT_REPORTS_CONFIG_FILE
		);
		if (
			[config.accountId, config.bucket, config.accessKeyId, config.secretAccessKey].some(
				(value) => !value
			)
		)
			throw new Error('Cloudflare R2 screenshot storage is not configured');
		if (config.endpoint && !/^http:\/\/127\.0\.0\.1:\d+$/.test(config.endpoint))
			throw new Error('R2 endpoint override must be a local test server');
		return new R2ScreenshotStoreAdapter(config);
	}
	async put(reportId: string, file: string, bytes: Buffer, mime: string) {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.config.bucket,
				Key: r2ObjectKey(reportId, file),
				Body: bytes,
				ContentType: mime
			})
		);
	}
	async get(reportId: string, file: string) {
		const response = await this.client.send(
			new GetObjectCommand({ Bucket: this.config.bucket, Key: r2ObjectKey(reportId, file) })
		);
		if (!response.Body) throw new Error('R2 image has no body');
		return Buffer.from(await response.Body.transformToByteArray());
	}
}
