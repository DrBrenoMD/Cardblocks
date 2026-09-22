import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

const html = `<div><script>alert("hello");</script></div>`;
console.log("No config:", purify.sanitize(html));
console.log("ADD_TAGS:", purify.sanitize(html, { ADD_TAGS: ['script'], FORCE_BODY: true }));
// Wait, might need ALLOW_UNKNOWN_PROTOCOLS, or just pass FORCE_BODY
