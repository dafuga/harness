import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { reportPdf } from '../src/utils/reportPdf';

function buildFixture(directory: string, python: string): string {
	const assets = join(directory, 'assets');
	mkdirSync(assets);
	const image = join(assets, 'practice.png');
	execFileSync(python, [
		'-c',
		"from PIL import Image, ImageDraw; import sys; image=Image.new('RGB',(1600,900),'#f8fafc'); draw=ImageDraw.Draw(image); draw.rectangle((120,100,1480,800),fill='#e8f6ee',outline='#15803d',width=12); draw.text((220,220),'Fluora practice screenshot',fill='#17262e'); image.save(sys.argv[1])",
		image
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

test('a downloaded report exposes its screenshots immediately', () => {
	const directory = mkdtempSync(join(tmpdir(), 'project-report-pdf-'));
	const python = reportPdf();
	try {
		const pdf = buildFixture(directory, python);
		captureCover(pdf);
		const counts = imageCounts(pdf, python);
		expect(counts[0]).toBeGreaterThan(0);
		expect(counts[1]).toBeGreaterThan(0);
		expect(counts.filter((count) => count > 0).length).toBeGreaterThanOrEqual(3);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
