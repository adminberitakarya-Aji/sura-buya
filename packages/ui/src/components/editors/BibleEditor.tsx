'use client';

import * as React from 'react';
import matter from 'gray-matter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

export interface BibleEditorProps {
  /** Raw markdown text, optionally starting with a `---` YAML frontmatter block. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  /** Initial active view. Defaults to 'split'. */
  defaultView?: 'write' | 'preview' | 'split';
}

interface ParsedBibleFile {
  frontmatter: Record<string, unknown>;
  content: string;
  error: string | null;
}

function parseBibleContent(raw: string): ParsedBibleFile {
  try {
    const { data, content } = matter(raw);
    return { frontmatter: data, content, error: null };
  } catch (err) {
    return {
      frontmatter: {},
      content: raw,
      error: err instanceof Error ? err.message : 'Gagal mem-parsing frontmatter.',
    };
  }
}

/** Combine a frontmatter object and markdown body back into raw file text. */
export function stringifyBibleContent(
  frontmatter: Record<string, unknown>,
  content: string
): string {
  if (Object.keys(frontmatter).length === 0) return content;
  return matter.stringify(content, frontmatter);
}

/**
 * Parse raw bible file text into { frontmatter, content }. Exported for
 * callers that need to persist the two fields separately (e.g. before
 * calling a save API that stores them in separate DB columns).
 */
export function parseBibleFile(raw: string): {
  frontmatter: Record<string, unknown>;
  content: string;
} {
  const { frontmatter, content } = parseBibleContent(raw);
  return { frontmatter, content };
}

export function BibleEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  className,
  defaultView = 'split',
}: BibleEditorProps) {
  const parsed = React.useMemo(() => parseBibleContent(value), [value]);
  const frontmatterEntries = Object.entries(parsed.frontmatter);

  return (
    <div className={cn('flex flex-col', className)}>
      <Tabs defaultValue={defaultView} className="flex flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="write">Tulis</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="split" className="hidden md:inline-flex">
              Split
            </TabsTrigger>
          </TabsList>
          {frontmatterEntries.length > 0 && (
            <Badge variant="outline" className="font-normal">
              {frontmatterEntries.length} field frontmatter
            </Badge>
          )}
        </div>

        {parsed.error && (
          <div className="mb-2 flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Frontmatter tidak valid: {parsed.error}. Preview akan menampilkan seluruh teks
              sebagai konten.
            </span>
          </div>
        )}

        <TabsContent value="write" className="flex-1">
          <EditorTextarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="preview" className="flex-1">
          <PreviewPane frontmatter={parsed.frontmatter} content={parsed.content} />
        </TabsContent>

        <TabsContent value="split" className="hidden flex-1 md:block">
          <div className="grid h-full grid-cols-2 gap-4">
            <EditorTextarea
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              readOnly={readOnly}
            />
            <PreviewPane frontmatter={parsed.frontmatter} content={parsed.content} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EditorTextarea({
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? '---\ntitle: Judul\n---\n\nTulis konten markdown di sini...'}
      readOnly={readOnly}
      spellCheck={false}
      className="h-full min-h-[400px] w-full resize-none rounded-md border border-input bg-transparent p-3 font-mono text-sm leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function PreviewPane({
  frontmatter,
  content,
}: {
  frontmatter: Record<string, unknown>;
  content: string;
}) {
  const entries = Object.entries(frontmatter);

  return (
    <div className="h-full min-h-[400px] overflow-y-auto rounded-md border bg-card p-4">
      {entries.length > 0 && (
        <dl className="mb-4 space-y-1 border-b pb-4 text-xs">
          {entries.map(([key, val]) => (
            <div key={key} className="flex gap-2">
              <dt className="font-medium text-muted-foreground">{key}:</dt>
              <dd className="text-foreground">{formatFrontmatterValue(val)}</dd>
            </div>
          ))}
        </dl>
      )}
      <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content || '*Belum ada konten.*'}
        </ReactMarkdown>
      </article>
    </div>
  );
}

function formatFrontmatterValue(val: unknown): string {
  if (Array.isArray(val)) return val.join(', ');
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
