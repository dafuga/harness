import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { reportPdf } from '../src/utils/reportPdf';

function fixture(directory: string, height = 720) {
	const assets = join(directory, 'assets');
	mkdirSync(assets);
	const source = join(assets, 'capture.jpg');
	execFileSync(reportPdf(), [
		'-c',
		'import random,sys; from PIL import Image; height=int(sys.argv[2]); pixels=random.Random(42).randbytes(1280*height*3); Image.frombytes("RGB",(1280,height),pixels).save(sys.argv[1],quality=45)',
		source,
		String(height)
	]);
	const manifest = join(directory, 'manifest.json');
	writeFileSync(
		manifest,
		JSON.stringify({
			id: 'jpeg-pdf-fixture',
			project: { name: 'Reports' },
			mode: 'feature',
			title: 'Original screenshot preservation',
			status: 'passed',
			environment: 'test',
			summary: 'A full JPEG screenshot retains its original encoded bytes.',
			findings: [],
			checks: [],
			acceptance: [],
			coverage: [],
			evidence: [
				{
					title: 'Original capture',
					file: 'capture.jpg',
					category: 'Game',
					viewport: '1280x720',
					phase: 'after',
					status: 'passed'
				}
			]
		})
	);
	const pdf = join(directory, 'report.pdf');
	execFileSync(reportPdf(), [join(process.cwd(), 'scripts/build_pdf.py'), manifest, pdf, assets]);
	return { source, pdf };
}

function embeddedHashes(pdf: string): string[] {
	return JSON.parse(
		execFileSync(
			reportPdf(),
			[
				'-c',
				'import hashlib,json,sys; from pypdf import PdfReader; r=PdfReader(sys.argv[1]); print(json.dumps([hashlib.sha256(o.get_object().get_data()).hexdigest() for p in r.pages if "/XObject" in p.get("/Resources",{}) for o in p["/Resources"]["/XObject"].get_object().values() if o.get_object().get("/Subtype")=="/Image"]))',
				pdf
			],
			{ encoding: 'utf8' }
		)
	) as string[];
}

function capture(pdf: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const target = join(process.cwd(), 'output/evidence');
	mkdirSync(target, { recursive: true });
	execFileSync('pdftoppm', [
		'-f',
		'2',
		'-l',
		'2',
		'-png',
		'-singlefile',
		'-r',
		'72',
		pdf,
		join(target, 'jpeg-pdf-' + (process.env.SCREENSHOT_LABEL || 'current'))
	]);
}

test('full JPEG screenshots retain original bytes without inflating the PDF', () => {
	const directory = mkdtempSync(join(tmpdir(), 'jpeg-pdf-'));
	try {
		const { source, pdf } = fixture(directory);
		capture(pdf);
		const hash = createHash('sha256').update(readFileSync(source)).digest('hex');
		expect(embeddedHashes(pdf)).toContain(hash);
		expect(statSync(pdf).size).toBeLessThan(statSync(source).size * 2 + 100_000);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('tall JPEG screenshots retain all vertical content across PDF pages', () => {
	const directory = mkdtempSync(join(tmpdir(), 'jpeg-pdf-tall-'));
	try {
		const { pdf } = fixture(directory, 3000);
		const heights = JSON.parse(
			execFileSync(
				reportPdf(),
				[
					'-c',
					'import json,sys; from pypdf import PdfReader; r=PdfReader(sys.argv[1]); print(json.dumps([int(o.get_object()["/Height"]) for p in r.pages[1:] if "/XObject" in p.get("/Resources",{}) for o in p["/Resources"]["/XObject"].get_object().values() if o.get_object().get("/Subtype")=="/Image"]))',
					pdf
				],
				{ encoding: 'utf8' }
			)
		) as number[];
		expect(heights.length).toBeGreaterThan(1);
		expect(heights.reduce((sum, value) => sum + value, 0)).toBe(3000);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
