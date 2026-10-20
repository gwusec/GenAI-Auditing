import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MarkdownContent from './MarkdownContent';

const renderMarkdown = (source) => renderToStaticMarkup(
    <MarkdownContent>{source}</MarkdownContent>,
);

test('renders inline code inside a paragraph without inserting a pre element', () => {
    const html = renderMarkdown('Use `npm test` before merging.');

    expect(html).toContain('<p');
    expect(html).toContain('<code>npm test</code>');
    expect(html).not.toContain('<pre');
});

test('renders a fenced code block with one pre and one code element', () => {
    const html = renderMarkdown('```js\nconst answer = 42;\n```');

    expect(html.match(/<pre/g)).toHaveLength(1);
    expect(html.match(/<code/g)).toHaveLength(1);
    expect(html).toContain('class="language-js"');
    expect(html).toContain('const answer = 42;');
});

test('preserves links, GFM lists, and serialized audit marks', () => {
    const html = renderMarkdown(
        '- [Source](https://example.com)\n- <trails-audit-mark data-id="finding-1">flagged text</trails-audit-mark>',
    );

    expect(html).toContain('<ul>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('<mark data-id="finding-1"');
    expect(html).toContain('flagged text</mark>');
});
