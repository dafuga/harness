import type { VerificationScope } from './verification-targets';
/** Existing API cases remain the admission scenario's only behavioral test rows. */
export const uploadVerificationScopes: Record<string, VerificationScope> = {
	'upload-request-admission': {
		package: 'reports',
		vitest: {
			'test/routes/report-audio-upload-api.test.ts': {
				'audio uploads reject cross-origin, invalid content type and oversized requests':
					'audio-upload'
			},
			'test/routes/report-audio-comparison-api.test.ts': {
				'paired audio uploads reject cross-origin, invalid content type and oversized requests':
					'audio-comparison'
			},
			'test/routes/report-screenshot-upload-api.test.ts': {
				'upload endpoint rejects cross-origin requests before reading files': 'screenshot-upload',
				'upload endpoint reports missing R2 configuration clearly': 'screenshot-upload'
			}
		},
		playwright: {}
	}
};
