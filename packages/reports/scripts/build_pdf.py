"""Readable project report PDF with check summary and screenshot pages."""
import json
import math
import sys
from io import BytesIO
from html import escape
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage

manifest_path, output_path, assets_path = map(Path, sys.argv[1:4])
report = json.loads(manifest_path.read_text())
font_path = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
if font_path.exists():
    pdfmetrics.registerFont(TTFont('ReportFont', str(font_path)))
font = 'ReportFont' if font_path.exists() else 'Helvetica'
ink = colors.HexColor('#17262e')
gold = colors.HexColor('#9a6c27')
muted = colors.HexColor('#4a5c65')
styles = {
    'title': ParagraphStyle('title', fontName=font, fontSize=28, leading=32, textColor=ink, spaceAfter=18),
    'section': ParagraphStyle('section', fontName=font, fontSize=17, leading=22, textColor=ink, spaceBefore=22, spaceAfter=10),
    'body': ParagraphStyle('body', fontName=font, fontSize=11, leading=16, textColor=ink, spaceAfter=10),
    'small': ParagraphStyle('small', fontName=font, fontSize=9, leading=13, textColor=muted, spaceAfter=8),
    'gold': ParagraphStyle('gold', fontName=font, fontSize=10, leading=14, textColor=gold, spaceAfter=8),
}
styles['audioTitle'] = ParagraphStyle('audioTitle', parent=styles['gold'], keepWithNext=True)
story = []
def text(value, style='body'):
    story.append(Paragraph(escape(str(value or '')).replace('\n', '<br/>'), styles[style]))
def section(label):
    text(label, 'section')
def rows(items, value):
    if not items:
        text('No entries recorded.', 'small')
    for item in items:
        text(item.get('title', ''), 'gold')
        text(value(item), 'small')

def available_image(item):
    if item.get('mediaType') == 'audio' or Path(item['file']).suffix.lower() in ('.wav', '.mp3', '.m4a', '.ogg'):
        return None
    if item.get('missing'):
        return None
    path = assets_path / item['file']
    return path if path.is_file() and not path.is_symlink() else None

def add_image(picture, width, height, source=None):
    if source is not None:
        story.append(Image(str(source), width=width, height=height))
        return
    buffer = BytesIO()
    picture.save(buffer, format='PNG')
    buffer.seek(0)
    story.append(Image(buffer, width=width, height=height))

def page(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#d7dee1'))
    canvas.line(40, 34, document.pagesize[0] - 40, 34)
    canvas.setFont(font, 8)
    canvas.setFillColor(muted)
    canvas.drawString(40, 20, report['project']['name'] + ' / ' + report['environment'])
    canvas.drawRightString(document.pagesize[0]-40, 20, str(document.page))
    canvas.restoreState()

text(report['project']['name'].upper() + ' / ' + report['mode'].upper(), 'gold')
text(report['title'], 'title')
text('Outcome: ' + report['status'].upper() + '  |  Environment: ' + report['environment'], 'gold')
text('Revision: ' + (report.get('revision') or 'Not proven') + '  |  Run: ' + report['id'], 'small')
if report.get('historical'):
    text('HISTORICAL EVIDENCE - imported from an earlier run; checks were not rerun.', 'gold')
section('What changed')
text(report.get('summary') or 'No summary was recorded.')
page_width, page_height = 1280, 900
max_width, max_height = page_width - 80, page_height - 210
available = [item for item in report['evidence'] if available_image(item)]
preview = next((item for item in available if item.get('phase') == 'after'),
               available[0] if available else None)
if preview:
    section('Screenshot preview')
    text(preview['title'], 'gold')
    with PILImage.open(available_image(preview)) as picture:
        scale = min(max_width / picture.width, 430 / picture.height, 1)
        source = available_image(preview) if picture.format == 'JPEG' else None
        add_image(picture, picture.width * scale, picture.height * scale, source)
    text('Full-size screenshots follow on the next pages.', 'small')
    story.append(PageBreak())

for item in report['evidence']:
    if item.get('mediaType') == 'audio' or Path(item['file']).suffix.lower() in ('.wav', '.mp3', '.m4a', '.ogg'):
        continue
    image_path = available_image(item)
    if image_path is None:
        text(item['title'], 'section')
        text('Image unavailable. Visual evidence is not proven.', 'gold')
        story.append(PageBreak())
        continue
    with PILImage.open(image_path) as picture:
        width, height = picture.size
        fit_scale = min(max_width / width, max_height / height, 1)
        scale = fit_scale if width * fit_scale >= max_width / 2 else min(max_width / width, 1)
        tile_height = max(1, math.floor(max_height / scale))
        parts = math.ceil(height / tile_height)
        for index, top in enumerate(range(0, height, tile_height)):
            label = item['title'] + (f' (part {index + 1}/{parts})' if parts > 1 else '')
            text(label, 'section')
            text(' / '.join([item.get('category', ''), item.get('viewport', ''),
                 item.get('phase', ''), item['status'].upper()]), 'small')
            if item.get('note') and index == 0:
                text(item['note'], 'small')
            crop = picture.crop((0, top, width, min(height, top + tile_height)))
            source = image_path if picture.format == 'JPEG' and parts == 1 else None
            add_image(crop, width * scale, crop.height * scale, source)
            story.append(PageBreak())

audio = [item for item in report['evidence'] if item.get('mediaType') == 'audio' or
         Path(item['file']).suffix.lower() in ('.wav', '.mp3', '.m4a', '.ogg')]
if audio:
    section('Audio recordings')
    text('Play and download the original audio in the report gallery or portable HTML. '
         'The ZIP contains the registered originals. Playback is unavailable in a PDF.', 'small')
    for item in audio:
        text(item['title'], 'audioTitle')
        state = 'AUDIO UNAVAILABLE - NOT PROVEN' if item.get('missing') else item['status'].upper()
        duration = item.get('durationSeconds')
        text(' / '.join(filter(None, [item.get('category'), state,
             f'{duration:.2f} seconds' if isinstance(duration, (int, float)) else '',
             item.get('source'), item.get('capturedAt')])), 'small')
        if item.get('transcript'):
            text('Transcript: ' + item['transcript'], 'small')
        if item.get('note'):
            text(item['note'], 'small')
        text('Original asset: assets/' + item['file'], 'small')

section('Findings and remaining issues')
rows(report['findings'], lambda item: item['status'].upper() + ' - ' + item.get('detail', ''))
section('Verification')
rows(report['checks'], lambda item: item['status'].upper() + ' - ' + item.get('group', '') +
     ('  |  ' + str(item.get('counts')) if item.get('counts') else ''))
section('Acceptance criteria')
for criterion in report['acceptance']:
    text('• ' + criterion)
section('Workflow coverage')
rows(report['coverage'], lambda item: item['status'].upper() + ' - ' +
     item.get('viewport', '') + '  ' + item.get('detail', ''))
doc = SimpleDocTemplate(str(output_path), pagesize=(page_width, page_height),
                        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=50,
                        title=report['title'], author='Project Reports')
doc.build(story, onFirstPage=page, onLaterPages=page)
