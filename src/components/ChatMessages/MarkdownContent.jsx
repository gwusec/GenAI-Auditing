import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import styles from './ChatMessages.module.css';

const markdownComponents = {
    p: ({ node, ...props }) => (
        <p {...props} className={styles['markdown-paragraph']} />
    ),
    a: ({ node, children, ...props }) => (
        <a {...props} className={styles['markdown-link']}>
            {children}
        </a>
    ),
    pre: ({ node, ...props }) => (
        <pre {...props} className={styles['block-code']} />
    ),
    // Audit highlights are serialized into message Markdown as a custom tag.
    'trails-audit-mark': ({ node, children, ...props }) => (
        <mark {...props} className={styles['markdown-mark']}>
            {children}
        </mark>
    ),
};

const MarkdownContent = ({ children }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
    >
        {children}
    </ReactMarkdown>
);

export default MarkdownContent;
