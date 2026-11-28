// Agents dock: the corner pill, the open panel and a chat with an agent that has a question.
import { asking, working } from '../data-agents.mjs';
import { av, mk, pill } from './bits.mjs';

export const dockPill = () => `
<button type="button" class="dock-pill" aria-label="Agents, 3 have questions">
	<span class="av-stack">${asking.map((a) => av(a.initials, 'needs')).join('')}</span>
	Agents
	${pill('needs', '3 have questions')}
</button>`;

const askRow = (a) => `
<li><button type="button" class="agent asks">
	${av(a.initials, 'needs')}
	<span class="grow"><span class="agent-name"><span class="clip1">${a.name}</span><span class="when num"><i>waiting </i>${a.when}</span></span><span class="agent-sub clip1">${a.sub}</span></span>
	<span class="go" aria-hidden="true">&rsaquo;</span>
</button></li>`;

const workRow = (a) => `
<li><button type="button" class="agent">
	${av(a.initials, a.tone)}
	<span class="grow"><span class="agent-name"><span class="clip1">${a.name}</span></span><span class="agent-sub clip1">${a.sub}</span></span>
	${pill('active', 'Working')}
</button></li>`;

export const dockBody = () => `
<div class="dock-body">
	<section class="dock-group" data-tone="needs">
		<h3 class="kicker">${mk('needs')}Have a question for you</h3>
		<ul class="dock-group">${asking.map(askRow).join('')}</ul>
	</section>
	<section class="dock-group">
		<h3 class="kicker">Working</h3>
		<ul class="dock-rows">${working.map(workRow).join('')}</ul>
	</section>
</div>`;

export const dockHead = (close = '&times;') => `
<header class="dock-head">
	<div class="grow"><h2 class="dock-title">Agents</h2><p class="muted" style="font-size: 13px">3 have questions · 4 working</p></div>
	<button type="button" class="icon-btn" aria-label="Close">${close}</button>
</header>`;

export const dockFoot = () => `
<footer class="dock-foot"><button type="button" class="btn primary wide">New conversation</button></footer>`;

export const dock = () => `
<aside class="dock" aria-label="Agents">${dockHead()}${dockBody()}${dockFoot()}</aside>`;

const option = (label, hint, recommended) => `
<button type="button" class="option">${recommended ? '<span class="badge">Recommended</span>' : ''}${label}${hint ? `<small>${hint}</small>` : ''}</button>`;

export const options = (hints = true) => `
<div class="options">
	${option('Grid of all screens', hints && 'Every screen at a glance', true)}
	${option('Last screen viewed', hints && 'Pick up where you left off')}
	${option('First screen, full size', hints && 'Largest view of one screen')}
	${option('Other…', hints && 'Write your own answer')}
</div>`;

export const chatHead = () => `
<header class="dock-head">
	<button type="button" class="icon-btn" aria-label="Back to agents">&lsaquo;</button>
	${av('HC', 'needs')}
	<div class="grow"><h2 class="dock-title">Harness Coder</h2><p class="muted" style="font-size: 13px">Design canvas viewer · Primary Mac</p></div>
	<button type="button" class="icon-btn" aria-label="Close">&times;</button>
</header>`;

export const chatBody = () => `
<div class="chat">
	<p class="bubble">The viewer is built and its checks pass. One choice is left before I open the pull request.</p>
	<div class="ask">
		<p class="kicker" style="color: var(--hx-color-accent)">Question · waiting 2h 14m</p>
		<p class="ask-q">Which layout should the design canvas open with?</p>
		${options(false)}
	</div>
</div>
<div class="composer"><span class="grow">Message Harness Coder</span><span class="btn sm">Send</span></div>`;

export const dockChat = () => `
<aside class="dock" aria-label="Chat with Harness Coder">${chatHead()}${chatBody()}</aside>`;
