import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { reportPdf } from '../src/utils/reportPdf';

function buildFixture(directory: string, python: string, width = 1600, height = 900): string {
	const assets = join(directory, 'assets');
	mkdirSync(assets);
	const image = join(assets, 'practice.png');
	execFileSync(python, [
		'-c',
		"from PIL import Image, ImageDraw; import sys; image=Image.new('RGB',(int(sys.argv[2]),int(sys.argv[3])),'#f8fafc'); draw=ImageDraw.Draw(image); draw.rectangle((120,100,1480,800),fill='#e8f6ee',outline='#15803d',width=12); draw.text((220,220),'Fluora practice screenshot',fill='#17262e'); image.save(sys.argv[1])",
		image,
		String(width),
		String(height)
	]);
	const report = {
		id: 'pdf-evidence-fixture',
		project: { name: 'Fluora' },
		mode: 'feature',
		title: 'Practice word Hear replay verification',
		status: 'blocked',
		environment: 'local browser',
		revision: 'tested-commit',
		historical: false,
		summary: 'The button now changes state immediately while the audio starts.',
		findings: [],
		checks: Array.from({ length: 6 }, (_, index) => ({
			title: `Check ${index + 1}`,
			status: 'passed'
		})),
		acceptance: ['Immediate feedback', 'Replay on every click', 'No duplicate request'],
		coverage: [],
		evidence: (['before', 'after'] as const).map((phase) => ({
			title: `${phase} click`,
			category: 'Practice',
			viewport: 'desktop',
			phase,
			status: 'passed',
			file: 'practice.png'
		}))
	};
	const manifest = join(directory, 'manifest.json');
	const pdf = join(directory, 'report.pdf');
	writeFileSync(manifest, JSON.stringify(report));
	execFileSync(python, [join(process.cwd(), 'scripts/build_pdf.py'), manifest, pdf, assets]);
	return pdf;
}

function captureCover(pdf: string): void {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const output = join(process.cwd(), 'output/evidence');
	mkdirSync(output, { recursive: true });
	execFileSync('pdftoppm', [
		'-f',
		'1',
		'-l',
		'1',
		'-png',
		'-singlefile',
		'-r',
		'96',
		pdf,
		join(output, `pdf-screenshot-visibility-${process.env.SCREENSHOT_LABEL || 'current'}`)
	]);
}

function imageCounts(pdf: string, python: string): number[] {
	return JSON.parse(
		execFileSync(
			python,
			[
				'-c',
				'import json,sys; from pypdf import PdfReader; print(json.dumps([len(page.images) for page in PdfReader(sys.argv[1]).pages]))',
				pdf
			],
			{ encoding: 'utf8' }
		)
	) as number[];
}

function imageHeights(pdf: string, python: string): number[] {
	return JSON.parse(
		execFileSync(
			python,
			[
				'-c',
				'import json,sys; from pypdf import PdfReader; print(json.dumps([image.image.height for page in PdfReader(sys.argv[1]).pages for image in page.images]))',
				pdf
			],
			{ encoding: 'utf8' }
		)
	) as number[];
}

test.each([1600, 1440])('a downloaded report shows complete 900px screenshots at %ipx', (width) => {
	const directory = mkdtempSync(join(tmpdir(), 'project-report-pdf-'));
	const python = reportPdf();
	try {
		const pdf = buildFixture(directory, python, width);
		captureCover(pdf);
		const counts = imageCounts(pdf, python);
		expect(counts[0]).toBeGreaterThan(0);
		expect(counts[1]).toBeGreaterThan(0);
		expect(counts.filter((count) => count > 0)).toHaveLength(3);
		expect(imageHeights(pdf, python)).toEqual([900, 900, 900]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('tall screenshot pagination preserves every source row', () => {
	const directory = mkdtempSync(join(tmpdir(), 'project-report-pdf-tall-'));
	const python = reportPdf();
	try {
		const pdf = buildFixture(directory, python, 300, 1200);
		const heights = imageHeights(pdf, python);
		expect(heights).toHaveLength(5);
		expect(heights.reduce((total, height) => total + height, 0)).toBe(3 * 1200);
		expect(Math.min(...heights)).toBeGreaterThan(1);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
