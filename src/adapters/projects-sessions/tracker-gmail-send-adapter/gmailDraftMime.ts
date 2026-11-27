// @harness-uid u_nchu7tvx63
import type { TrackerOutgoingMessage } from '../../../repositories/projects-sessions/TrackerOutgoingDraftRepository.types';
import type { TrackerGmailMailHeader, TrackerGmailReply } from '../TrackerGmailSendAdapter.types';

const messageId = /^<[^\s<>@\p{Cc}]+@[^\s<>@\p{Cc}]+>$/u;
const id = /^[A-Za-z0-9_-]{1,160}$/;
export const gmailNativeId = (value: string) => id.test(value);

export function gmailReply(
	headers: TrackerGmailMailHeader[],
	subject: string | undefined
): TrackerGmailReply | undefined {
	const reply = header(headers, 'message-id');
	const parent = header(headers, 'subject');
	if (
		!subject ||
		!reply ||
		!parent ||
		!messageId.test(reply) ||
		reply.length > 255 ||
		subjectKey(subject) !== subjectKey(parent)
	)
		return undefined;
	const references = (header(headers, 'references') ?? '')
		.split(/\s+/u)
		.filter((value) => value.length <= 255 && messageId.test(value) && value !== reply)
		.slice(-10);
	return { inReplyTo: reply, references: [...references, reply] };
}

export function gmailDraftMime(
	message: TrackerOutgoingMessage,
	attempt: string,
	reply: TrackerGmailReply | undefined
): string {
	const domain = message.account.split('@')[1];
	const body = Buffer.from(message.body.replace(/\r\n|\n|\r/g, '\r\n')).toString('base64');
	const lines = [
		'From: ' + message.account,
		'To: ' + message.to.join(',\r\n '),
		...(message.cc.length ? ['Cc: ' + message.cc.join(',\r\n ')] : []),
		...(message.subject ? ['Subject: ' + mimeSubject(message.subject)] : []),
		`Message-ID: <${attempt}@${domain}>`,
		...(reply
			? ['In-Reply-To: ' + reply.inReplyTo, 'References: ' + reply.references.join('\r\n ')]
			: []),
		'MIME-Version: 1.0',
		'Content-Type: text/plain; charset=UTF-8',
		'Content-Transfer-Encoding: base64',
		'',
		body.match(/.{1,76}/g)?.join('\r\n') ?? ''
	];
	return Buffer.from(lines.join('\r\n')).toString('base64url');
}

function header(headers: TrackerGmailMailHeader[], name: string) {
	return headers.find((entry) => entry.name.toLowerCase() === name)?.value.trim();
}

function subjectKey(subject: string) {
	return subject
		.trim()
		.replace(/^(?:re:\s*)+/i, '')
		.trim();
}

function mimeSubject(value: string): string {
	if (/^[\x20-\x7e]+$/.test(value)) return value;
	const words = value.match(/.{1,10}/gu) ?? [];
	return words.map((word) => `=?UTF-8?B?${Buffer.from(word).toString('base64')}?=`).join('\r\n ');
}
