/**
 * Markdown Rendering Composable
 * Provides markdown-to-HTML conversion with syntax highlighting and table support
 */

import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

// Create markdown parser instance
const md = new MarkdownIt({
  html: true, // Enable HTML tags in source
  linkify: true, // Auto-convert URLs to links
  typographer: true, // Enable smart quotes and other typographic replacements
  breaks: true, // Convert \n to <br>
  highlight: function (str, lang) {
    // Syntax highlighting for code blocks
    if (lang && hljs.getLanguage(lang)) {
      try {
        return (
          '<pre class="hljs"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
        );
      } catch (__) {
        // Ignore errors
      }
    }

    // No language specified, no highlighting
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  },
});

// Enable GitHub Flavored Markdown (GFM) tables
// This is built-in to markdown-it, just need to ensure it's enabled
// Tables use | syntax: | Header 1 | Header 2 |

export function useMarkdown() {
  /**
   * Convert markdown string to HTML
   */
  const renderMarkdown = (markdown: string): string => {
    if (!markdown) return '';
    return md.render(markdown);
  };

  /**
   * Convert markdown inline (no <p> tags)
   */
  const renderInlineMarkdown = (markdown: string): string => {
    if (!markdown) return '';
    return md.renderInline(markdown);
  };

  /**
   * Check if text contains markdown syntax
   */
  const hasMarkdown = (text: string): boolean => {
    if (!text) return false;

    // Check for common markdown patterns
    const markdownPatterns = [
      /^#{1,6}\s/, // Headers
      /\*\*.*\*\*/, // Bold
      /\*.*\*/, // Italic
      /\[.*\]\(.*\)/, // Links
      /```/, // Code blocks
      /\|.*\|/, // Tables
      /^[-*+]\s/, // Lists
      /^\d+\.\s/, // Numbered lists
    ];

    return markdownPatterns.some((pattern) => pattern.test(text));
  };

  return {
    renderMarkdown,
    renderInlineMarkdown,
    hasMarkdown,
  };
}
