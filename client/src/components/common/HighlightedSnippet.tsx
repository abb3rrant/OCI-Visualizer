import React from 'react';

interface HighlightedSnippetProps {
  text: string;
  query: string;
  isRegex?: boolean;
}

export default function HighlightedSnippet({ text, query, isRegex }: HighlightedSnippetProps) {
  if (!query) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let key = 0;

  if (isRegex) {
    let re: RegExp;
    try {
      re = new RegExp(query.replace(/\(\?[imsx]+\)/g, ''), 'gi');
    } catch {
      // Invalid regex — render plain text
      return <>{text}</>;
    }
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
      parts.push(
        <mark key={key++} className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded px-0.5">
          {match[0]}
        </mark>
      );
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  } else {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let lastIdx = 0;
    let idx = lowerText.indexOf(lowerQuery);
    while (idx !== -1) {
      if (idx > lastIdx) parts.push(text.slice(lastIdx, idx));
      parts.push(
        <mark key={key++} className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
      );
      lastIdx = idx + query.length;
      idx = lowerText.indexOf(lowerQuery, lastIdx);
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  }

  return <>{parts.length > 0 ? parts : text}</>;
}
