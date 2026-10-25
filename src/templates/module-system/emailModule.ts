export const emailModule = {
	schemaVersion: 1,
	id: 'email',
	version: '1.0.0',
	title: 'Email',
	description: 'Transactional email through Resend, with reusable email resources.',
	instructions: [
		'Reference: BuildFlexity separates reusable email content from one Resend delivery boundary.',
		'Configure RESEND_API_KEY and RESEND_EMAIL_FROM in project-specific server secrets; never expose them in browser code.',
		'Set DISABLE_EMAILS=true during development. Installation and generation never send emails.',
		'Generate email resources, localize their content, and call EmailService.send with an authorized recipient.',
		'The local rate limit protects one service instance. Use a persistent shared limiter for multi-instance deployments.'
	],
	setup: [
		{
			path: 'src/services/email/EmailService.types.ts',
			contents:
				"export interface EmailEnvironment {\n\tRESEND_API_KEY?: string;\n\tRESEND_EMAIL_FROM?: string;\n\tDISABLE_EMAILS?: string;\n}\nexport interface EmailMessage {\n\trecipient: string;\n\tsubject: string;\n\ttext: string;\n\thtml?: string;\n}\nexport type EmailDelivery = { status: 'disabled' } | { status: 'sent'; id: string };\n"
		},
		{
			path: 'src/services/email/EmailService.ts',
			contents:
				"import type { EmailEnvironment, EmailMessage, EmailDelivery } from './EmailService.types';\n\n/** Server-only Resend delivery. Rendering and localization belong to each mailer. */\nexport class EmailService {\n\tprivate sent = 0;\n\tprivate windowStarted = Date.now();\n\tconstructor(\n\t\tprivate readonly env: EmailEnvironment,\n\t\tprivate readonly transport: typeof globalThis.fetch = globalThis.fetch\n\t) {}\n\tasync send(message: EmailMessage): Promise<EmailDelivery> {\n\t\tif (this.env.DISABLE_EMAILS === 'true') return { status: 'disabled' };\n\t\tthis.validate(message);\n\t\tthis.admit();\n\t\tconst response = await this.deliver(message);\n\t\tif (!response.ok) {\n\t\t\tawait response.body?.cancel();\n\t\t\tthrow new Error(\n\t\t\t\tresponse.status === 429 ? 'Email provider usage limit reached.' : 'Email delivery failed.'\n\t\t\t);\n\t\t}\n\t\tconst result: unknown = await response.json().catch(() => null);\n\t\tif (\n\t\t\t!result ||\n\t\t\ttypeof result !== 'object' ||\n\t\t\t!('id' in result) ||\n\t\t\ttypeof result.id !== 'string' ||\n\t\t\t!result.id\n\t\t)\n\t\t\tthrow new Error('Email provider did not acknowledge delivery.');\n\t\treturn { status: 'sent', id: result.id };\n\t}\n\tprivate deliver(message: EmailMessage): Promise<Response> {\n\t\treturn this.transport('https://api.resend.com/emails', {\n\t\t\tmethod: 'POST',\n\t\t\tredirect: 'manual',\n\t\t\tsignal: AbortSignal.timeout(10_000),\n\t\t\theaders: {\n\t\t\t\t'Content-Type': 'application/json',\n\t\t\t\tAuthorization: `Bearer ${this.env.RESEND_API_KEY}`\n\t\t\t},\n\t\t\tbody: JSON.stringify({\n\t\t\t\tfrom: this.env.RESEND_EMAIL_FROM,\n\t\t\t\tto: [message.recipient],\n\t\t\t\tsubject: message.subject,\n\t\t\t\ttext: message.text,\n\t\t\t\t...(message.html ? { html: message.html } : {})\n\t\t\t})\n\t\t}).catch(() => {\n\t\t\tthrow new Error('Email service is unavailable.');\n\t\t});\n\t}\n\n\tprivate validate(message: EmailMessage): void {\n\t\tif (!this.env.RESEND_API_KEY || !this.env.RESEND_EMAIL_FROM)\n\t\t\tthrow new Error('Configure the email provider and sender.');\n\t\tif (\n\t\t\t!/^[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+$/.test(message.recipient) ||\n\t\t\t!message.subject.trim() ||\n\t\t\t/[\\r\\n]/.test(message.subject)\n\t\t)\n\t\t\tthrow new Error('Invalid email message.');\n\t}\n\tprivate admit(): void {\n\t\tif (Date.now() - this.windowStarted >= 3_600_000) {\n\t\t\tthis.windowStarted = Date.now();\n\t\t\tthis.sent = 0;\n\t\t}\n\t\tif (this.sent >= 100) throw new Error('Email sending rate limit reached.');\n\t\tthis.sent += 1;\n\t}\n}\n"
		},
		{
			path: 'test/services/email/email.test.ts',
			contents:
				"import { expect, test, vi } from 'vitest';\nimport { EmailService } from '../../../src/services/email/EmailService';\nconst message = { recipient: 'reader@example.test', subject: 'Welcome', text: 'Hello' };\ntest('email delivery uses the configured server sender and reports acceptance', async () => {\n\tconst transport = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>\n\t\tResponse.json({ id: 'synthetic-email' })\n\t);\n\tconst service = new EmailService(\n\t\t{ RESEND_API_KEY: 'test-only-key', RESEND_EMAIL_FROM: 'app@example.test' },\n\t\ttransport\n\t);\n\tawait expect(service.send(message)).resolves.toEqual({ status: 'sent', id: 'synthetic-email' });\n\texpect(transport).toHaveBeenCalledWith(\n\t\t'https://api.resend.com/emails',\n\t\texpect.objectContaining({ method: 'POST', redirect: 'manual' })\n\t);\n\texpect(JSON.parse(String(transport.mock.calls[0]?.[1]?.body))).toMatchObject({\n\t\tto: ['reader@example.test'],\n\t\tfrom: 'app@example.test'\n\t});\n});\ntest('disabled email makes no provider request and missing settings fail closed', async () => {\n\tconst transport = vi.fn();\n\tawait expect(\n\t\tnew EmailService({ DISABLE_EMAILS: 'true' }, transport).send(message)\n\t).resolves.toEqual({ status: 'disabled' });\n\tawait expect(new EmailService({}, transport).send(message)).rejects.toThrow('Configure');\n\texpect(transport).not.toHaveBeenCalled();\n});\ntest('provider errors stay useful without reflecting a secret response', async () => {\n\tconst transport = vi.fn(async () => new Response('provider-private-body', { status: 429 }));\n\tawait expect(\n\t\tnew EmailService(\n\t\t\t{ RESEND_API_KEY: 'test-only-key', RESEND_EMAIL_FROM: 'app@example.test' },\n\t\t\ttransport\n\t\t).send(message)\n\t).rejects.toThrow('usage limit');\n});\n"
		},
		{
			path: 'src/services/email/email.server.ts',
			contents:
				"// Import this server-only boundary from application handlers.\nexport { EmailService } from './EmailService';\n"
		}
	],
	dependencies: {},
	resources: [
		{
			id: 'email',
			title: 'Emails',
			singular: 'Email',
			kind: 'mailer',
			instructions: [
				'Keep rendering separate from delivery and localization in the application.',
				'Pass { recipient, ...new WelcomeMailer().render({ name }) } to the server-only EmailService.',
				'Run the generated rendering tests before wiring delivery.'
			],
			files: [
				{
					path: 'src/mailers/email/{{PascalName}}Mailer.types.ts',
					contents:
						'export interface {{PascalName}}MailerInput {\n\tname: string;\n}\nexport interface {{PascalName}}MailerMessage {\n\tsubject: string;\n\ttext: string;\n\thtml: string;\n}\n'
				},
				{
					path: 'src/mailers/email/{{PascalName}}Mailer.ts',
					contents:
						"import type {\n\t{{PascalName}}MailerInput,\n\t{{PascalName}}MailerMessage\n} from './{{PascalName}}Mailer.types';\n/** Render reusable content; pass the result to EmailService with an authorized recipient. */\nexport class {{PascalName}}Mailer {\n\trender(input: {{PascalName}}MailerInput): {{PascalName}}MailerMessage {\n\t\tconst escaped = input.name.replace(\n\t\t\t/[&<>\"']/g,\n\t\t\t(character) =>\n\t\t\t\t({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' })[character]!\n\t\t);\n\t\treturn {\n\t\t\tsubject: '{{PascalName}}',\n\t\t\ttext: `Hello ${input.name}`,\n\t\t\thtml: `<p>Hello ${escaped}</p>`\n\t\t};\n\t}\n}\n"
				},
				{
					path: 'test/mailers/email/{{kebabName}}.test.ts',
					contents:
						"import { expect, test } from 'vitest';\nimport { {{PascalName}}Mailer } from '../../../src/mailers/email/{{PascalName}}Mailer';\ntest('{{PascalName}} renders content without sending an email', () => {\n\tconst result = new {{PascalName}}Mailer().render({ name: '<Reader>' });\n\texpect(result.text).toBe('Hello <Reader>');\n\texpect(result.html).toBe('<p>Hello &lt;Reader&gt;</p>');\n});\n"
				}
			]
		}
	]
};
