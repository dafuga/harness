import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import type { TrackerAttachmentDocument } from '../../../../../../src/utils/projects-sessions/trackerAttachment.types';

const webLink = /^https:\/\//i;
const markdown = new Marked({ gfm: true });

/**
 * A spec is untrusted text. The result runs no script, submits nothing and loads nothing:
 * only the snapshot's own images are shown, and only https links leave the app.
 */
export function renderSpecMarkdown(document: TrackerAttachmentDocument): DocumentFragment {
	const fragment = DOMPurify.sanitize(markdown.parse(document.markdown, { async: false }), {
		RETURN_DOM_FRAGMENT: true,
		USE_PROFILES: { html: true },
		FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'video', 'audio'],
		FORBID_ATTR: ['style', 'id', 'name', 'srcset', 'background', 'poster']
	});
	for (const image of fragment.querySelectorAll('img')) placeImage(image, document.images ?? {});
	for (const link of fragment.querySelectorAll('a')) confineLink(link);
	for (const table of fragment.querySelectorAll('table')) wrapTable(table);
	return fragment;
}

function placeImage(image: HTMLImageElement, images: Record<string, string>) {
	const source = image.getAttribute('src') ?? '';
	const inline = Object.hasOwn(images, source) ? images[source] : decodedImage(images, source);
	if (inline) {
		image.src = inline;
		return;
	}
	const note = image.ownerDocument.createElement('em');
	note.textContent = `[Image not included: ${image.alt || source}]`;
	image.replaceWith(note);
}

/** The renderer may percent-encode a source that the markdown wrote with plain characters. */
function decodedImage(images: Record<string, string>, source: string) {
	const name = Object.keys(images).find((key) => encodeURI(key) === source);
	return name ? images[name] : undefined;
}

function confineLink(link: HTMLAnchorElement) {
	if (!webLink.test(link.getAttribute('href') ?? '')) {
		link.removeAttribute('href');
		return;
	}
	link.target = '_blank';
	link.rel = 'noopener noreferrer';
}

/** A wide table scrolls by itself, so the page never scrolls sideways on a phone. */
function wrapTable(table: HTMLTableElement) {
	const frame = table.ownerDocument.createElement('div');
	frame.className = 'spec-table';
	frame.tabIndex = 0;
	table.replaceWith(frame);
	frame.appendChild(table);
}
