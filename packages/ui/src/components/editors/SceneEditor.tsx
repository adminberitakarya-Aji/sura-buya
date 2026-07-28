import * as React from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus, Save, Loader2, GripVertical } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/utils';

export type SceneEditorBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'action'; text: string }
  | { id: string; type: 'dialogue'; character: string; line: string; parenthetical?: string }
  | { id: string; type: 'transition'; text: string };

export type SceneBlockType = SceneEditorBlock['type'];

const BLOCK_LABEL: Record<SceneBlockType, string> = {
  heading: 'SLUG LINE',
  action: 'AKSI',
  dialogue: 'DIALOG',
  transition: 'TRANSISI',
};

export interface SceneEditorProps {
  blocks: SceneEditorBlock[];
  onChange: (blocks: SceneEditorBlock[]) => void;
  /** Character names to hint in the dialogue block's datalist. */
  availableCharacters?: { id: string; name: string }[];
  onSave?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  className?: string;
}

let idCounter = 0;
function newBlockId(type: string): string {
  idCounter += 1;
  return `${type}-new-${idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Block-based scene editor: heading/action/dialogue/transition blocks,
 * each independently editable, reorderable, and deletable — as opposed to
 * editing the whole scene as one flat textarea. Fully controlled: the
 * parent owns `blocks` state and persistence (PATCH .../scenes/:id/blocks).
 */
export function SceneEditor({
  blocks,
  onChange,
  availableCharacters = [],
  onSave,
  isSaving = false,
  isDirty = false,
  className,
}: SceneEditorProps) {
  const datalistId = React.useId();

  function updateBlock(index: number, patch: Partial<SceneEditorBlock>) {
    const next = blocks.map((b, i) => (i === index ? ({ ...b, ...patch } as SceneEditorBlock) : b));
    onChange(next);
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    onChange(moveItem(blocks, index, target));
  }

  function addBlock(type: Exclude<SceneBlockType, 'heading'>) {
    const base = { id: newBlockId(type) };
    const block: SceneEditorBlock =
      type === 'dialogue'
        ? { ...base, type, character: '', line: '' }
        : { ...base, type, text: '' };
    onChange([...blocks, block]);
  }

  return (
    <div className={cn('space-y-3', className)}>
      <datalist id={datalistId}>
        {availableCharacters.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>

      <div className="space-y-2">
        {blocks.map((block, index) => (
          <div
            key={block.id}
            className="group flex items-start gap-2 rounded-md border bg-card p-2.5"
          >
            <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/40" />

            <div className="min-w-0 flex-1 space-y-1">
              <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                {BLOCK_LABEL[block.type]}
              </span>

              {block.type === 'heading' && (
                <Input
                  value={block.text}
                  onChange={(e) => updateBlock(index, { text: e.target.value })}
                  placeholder="INT. RUMAH SURO - PAGI"
                  className="font-mono text-xs font-semibold uppercase"
                />
              )}

              {block.type === 'action' && (
                <Textarea
                  value={block.text}
                  onChange={(e) => updateBlock(index, { text: e.target.value })}
                  placeholder="Deskripsi aksi/narasi..."
                  rows={2}
                  className="text-sm"
                />
              )}

              {block.type === 'transition' && (
                <Input
                  value={block.text}
                  onChange={(e) => updateBlock(index, { text: e.target.value })}
                  placeholder="CUT TO:"
                  className="text-right font-mono text-xs uppercase"
                />
              )}

              {block.type === 'dialogue' && (
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <Input
                      value={block.character}
                      onChange={(e) => updateBlock(index, { character: e.target.value })}
                      placeholder="Nama karakter"
                      list={datalistId}
                      className="w-40 text-xs font-semibold uppercase"
                    />
                    <Input
                      value={block.parenthetical ?? ''}
                      onChange={(e) => updateBlock(index, { parenthetical: e.target.value })}
                      placeholder="(nada bicara — opsional)"
                      className="flex-1 text-xs italic"
                    />
                  </div>
                  <Textarea
                    value={block.line}
                    onChange={(e) => updateBlock(index, { line: e.target.value })}
                    placeholder="Isi dialog..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-0.5 opacity-60 group-hover:opacity-100">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={index === blocks.length - 1}
                onClick={() => move(index, 1)}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => removeBlock(index)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        {blocks.length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
            Belum ada block. Tambahkan block di bawah untuk mulai menulis.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => addBlock('action')}>
            <Plus className="h-3.5 w-3.5" />
            Aksi
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => addBlock('dialogue')}>
            <Plus className="h-3.5 w-3.5" />
            Dialog
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => addBlock('transition')}>
            <Plus className="h-3.5 w-3.5" />
            Transisi
          </Button>
        </div>

        {onSave && (
          <Button type="button" size="sm" onClick={onSave} disabled={isSaving || !isDirty}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan
          </Button>
        )}
      </div>
    </div>
  );
}
