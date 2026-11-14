import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { withTempDir } from '../support/temporary';
import { measureWorkload } from '../support/measureWorkload';
import { PreviewWorkerService } from '../../packages/reports/src/lib/development-tooling/preview-node/preview-worker-service/PreviewWorkerService';

test('real preview worker retains required config and drops unrelated synthetic credentials', async () => {
	await withTempDir('preview-worker-env-', async (dir) => {
		const port = await freePort();
		const output = join(dir, 'environment.json');
		const entry = join(dir, 'worker.cjs');
		await writeFile(
			entry,
			`const http=require('node:http'); const fs=require('node:fs'); fs.writeFileSync(${JSON.stringify(output)},JSON.stringify({proxy:process.env.HTTPS_PROXY,node:process.env.NODE_OPTIONS,ci:process.env.CI,r2:process.env.PROJECT_REPORTS_R2_BUCKET,token:process.env.GH_TOKEN,secret:process.env.HARNESS_SYNTHETIC_SECRET})); const token=process.env.HARNESS_PREVIEW_WORKER_TOKEN; http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({protocol:'harness-worker-v1',pid:process.pid,errors:0,busy:false}));}).listen(${port},'127.0.0.1');`
		);
		vi.stubEnv('HTTPS_PROXY', 'http://preview.invalid:8000');
		vi.stubEnv('NODE_OPTIONS', '--no-warnings');
		vi.stubEnv('CI', 'true');
		vi.stubEnv('PROJECT_REPORTS_R2_BUCKET', 'synthetic-bucket');
		vi.stubEnv('GH_TOKEN', 'synthetic-github-token');
		vi.stubEnv('HARNESS_SYNTHETIC_SECRET', 'must-not-cross');
		const service = new PreviewWorkerService(entry, [], `http://127.0.0.1:${port}`);
		try {
			const handle = await measureWorkload(
				'service.preview-worker',
				'configured-worker-start',
				() => service.start()
			);
			try {
				expect(handle.url).toBe(`http://127.0.0.1:${port}`);
				expect(JSON.parse(await readFile(output, 'utf8'))).toEqual({
					proxy: 'http://preview.invalid:8000',
					node: '--no-warnings',
					ci: 'true',
					r2: 'synthetic-bucket',
					token: 'synthetic-github-token'
				});
			} finally {
				await handle.close();
			}
		} finally {
			vi.unstubAllEnvs();
		}
	});
});

async function freePort(): Promise<number> {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('No free TCP port.');
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve()))
	);
	return address.port;
}
