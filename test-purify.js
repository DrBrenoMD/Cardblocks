import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

const html = `<html><head><style>.hello { color: red; }</style></head><body><div class="hello">world</div></body></html>`;
console.log(purify.sanitize(html, { ADD_TAGS: ['style'] }));
