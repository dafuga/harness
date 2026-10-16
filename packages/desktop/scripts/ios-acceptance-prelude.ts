/**
 * TEST ONLY. What every expression that the native acceptance run evaluates in the page of the
 * app may use: text of the page, a field by its label, a control by its name. It is JavaScript
 * of that page, kept here as text; nothing of it runs in this process.
 */
export const pagePrelude = `
const text = (selector) => document.querySelector(selector)?.innerText ?? '';
const panel = () => text('[aria-label="Computer connection"]');
const footer = () => text('footer.status-bar').replace(/\\n/g, ' | ');
const field = (label) => [...document.querySelectorAll('label')].find((item) => item.textContent.trim().startsWith(label))?.querySelector('input');
const fill = (label, value) => { const input = field(label); if (!input) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); return true; };
const named = (name) => [...document.querySelectorAll('button, a')].find((item) => (item.getAttribute('aria-label') || item.textContent).trim() === name);
const press = (name) => { const control = named(name); if (!control) return false; control.click(); return true; };
const pressLink = (words) => { const link = [...document.querySelectorAll('a')].find((item) => item.textContent.includes(words)); if (!link) return false; link.click(); return true; };
`;
