import React from 'react';
import { formatStudentAgentMessage } from '../../utils/displayLabels';

const BLOCK_START = /^(?:#{1,3}\s+|>\s?|\s*[-*•]\s+|\s*\d+[.)]\s+|\s*```|\s*(?:---+|___+|\*\*\*+)\s*$)/;

function renderInlineMarkdown(value) {
  const tokenPattern = /(\*\*[^*]+?\*\*|__[^_]+?__|`[^`]+`|\*[^*]+?\*|_[^_]+?_|\[[^\]]+\]\([^)]+\))/g;
  return String(value).split(tokenPattern).filter(Boolean).map((part, index) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
    if (link) {
      return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    }
    return part;
  });
}

function getTableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function isTableSeparator(line) {
  const cells = getTableCells(line);
  return line.includes('|') && cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

function isListLine(line) {
  return /^\s*(?:[-*•]\s+|\d+[.)]\s+)/.test(line);
}

export default function AgentMessageContent({ content }) {
  const lines = formatStudentAgentMessage(content).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^\s*```/.test(line)) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(<pre key={`code-${blocks.length}`}><code>{codeLines.join('\n')}</code></pre>);
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = getTableCells(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(getTableCells(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="agent-message-table-wrap" key={`table-${blocks.length}`}>
          <table>
            <thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{renderInlineMarkdown(cell)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{renderInlineMarkdown(row[cellIndex] || '')}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      );
      continue;
    }

    const heading = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const HeadingTag = heading[1].length === 1 ? 'h3' : 'h4';
      blocks.push(<HeadingTag key={`heading-${blocks.length}`}>{renderInlineMarkdown(heading[2])}</HeadingTag>);
      index += 1;
      continue;
    }

    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      blocks.push(<hr key={`rule-${blocks.length}`} />);
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${blocks.length}`}>{quoteLines.map((part, partIndex) => (
        <React.Fragment key={partIndex}>{partIndex > 0 && <br />}{renderInlineMarkdown(part)}</React.Fragment>
      ))}</blockquote>);
      continue;
    }

    if (isListLine(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const ListTag = ordered ? 'ol' : 'ul';
      const items = [];
      while (index < lines.length && isListLine(lines[index]) && /^\s*\d+[.)]\s+/.test(lines[index]) === ordered) {
        const item = lines[index].replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/, '');
        items.push(<li key={items.length}>{renderInlineMarkdown(item)}</li>);
        index += 1;
      }
      blocks.push(<ListTag key={`list-${blocks.length}`}>{items}</ListTag>);
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !BLOCK_START.test(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${blocks.length}`}>{paragraphLines.map((part, partIndex) => (
      <React.Fragment key={partIndex}>{partIndex > 0 && <br />}{renderInlineMarkdown(part)}</React.Fragment>
    ))}</p>);
  }

  return <div className="agent-message-content">{blocks}</div>;
}
