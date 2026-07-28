import * as React from 'react';
import { Plus, Trash2, Sparkles, Loader2, Save, GripVertical } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

export type BeatType =
  | 'hook'
  | 'inciting'
  | 'rising'
  | 'complication'
  | 'climax'
  | 'resolution'
  | 'cliffhanger'
  | 'character'
  | 'worldbuilding'
  | 'relationship';

export type EmotionalArc = 'rising' | 'falling' | 'peak' | 'valley' | 'steady';
export type Stakes = 'low' | 'medium' | 'high' | 'critical';

export interface BeatBoardBeat {
  id: string;
  type: BeatType;
  order: number;
  description: string;
  characters: string[];
  location?: string;
  estimatedDuration: number;
  act: 1 | 2 | 3;
  dependencies: string[];
  emotionalArc: EmotionalArc;
  stakes: Stakes;
}

export interface BeatBoardProps {
  beats: BeatBoardBeat[];
  onChange: (beats: BeatBoardBeat[]) => void;
  onSave?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  onGenerate?: () => void;
  isGenerating?: boolean;
  className?: string;
}

const ACT_LABEL: Record<1 | 2 | 3, string> = { 1: 'Act 1 — Setup', 2: 'Act 2 — Konflik', 3: 'Act 3 — Resolusi' };

const TYPE_COLOR: Record<BeatType, string> = {
  hook: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400',
  inciting: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  rising: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  complication: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  climax: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  resolution: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  cliffhanger: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
  character: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  worldbuilding: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400',
  relationship: 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400',
};

const STAKES_LABEL: Record<Stakes, string> = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi', critical: 'Kritis' };

function reindex(beats: BeatBoardBeat[]): BeatBoardBeat[] {
  return beats.map((b, i) => ({ ...b, order: i }));
}

/**
 * Move `beatId` to `targetAct` at `targetIndex` (within that act's beats,
 * ordered by `order`), reassigning sequential `order` values for the
 * affected act(s). Returns a new flat beats array.
 */
function moveBeat(
  beats: BeatBoardBeat[],
  beatId: string,
  targetAct: 1 | 2 | 3,
  targetIndex: number
): BeatBoardBeat[] {
  const beat = beats.find((b) => b.id === beatId);
  if (!beat) return beats;

  const others = beats.filter((b) => b.id !== beatId);
  const targetActBeats = reindex(
    others.filter((b) => b.act === targetAct).sort((a, b) => a.order - b.order)
  );
  const otherActBeats = others.filter((b) => b.act !== targetAct);

  const clamped = Math.max(0, Math.min(targetIndex, targetActBeats.length));
  targetActBeats.splice(clamped, 0, { ...beat, act: targetAct });

  return [...otherActBeats, ...reindex(targetActBeats)];
}

function newBeatId(): string {
  return `beat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Episode Planner beat board: beats grouped into 3 act columns, draggable
 * between/within columns via native HTML5 DnD (no extra dependency). Fully
 * controlled — the parent owns `beats` and persistence.
 */
export function BeatBoard({
  beats,
  onChange,
  onSave,
  isSaving = false,
  isDirty = false,
  onGenerate,
  isGenerating = false,
  className,
}: BeatBoardProps) {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = React.useState<string | null>(null);

  function handleDrop(targetAct: 1 | 2 | 3, targetIndex: number) {
    if (!draggingId) return;
    onChange(moveBeat(beats, draggingId, targetAct, targetIndex));
    setDraggingId(null);
    setDragOverKey(null);
  }

  function updateBeat(id: string, patch: Partial<BeatBoardBeat>) {
    onChange(beats.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function removeBeat(id: string) {
    onChange(beats.filter((b) => b.id !== id));
  }

  function addBeat(act: 1 | 2 | 3) {
    const actBeats = beats.filter((b) => b.act === act);
    onChange([
      ...beats,
      {
        id: newBeatId(),
        type: 'character',
        order: actBeats.length,
        description: '',
        characters: [],
        estimatedDuration: 2,
        act,
        dependencies: [],
        emotionalArc: 'steady',
        stakes: 'medium',
      },
    ]);
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Seret kartu beat antar act atau di dalam act yang sama untuk mengatur urutan.
        </p>
        <div className="flex gap-2">
          {onGenerate && (
            <Button type="button" size="sm" variant="outline" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {beats.length > 0 ? 'Generate Ulang' : 'Generate Plan'}
            </Button>
          )}
          {onSave && (
            <Button type="button" size="sm" onClick={onSave} disabled={isSaving || !isDirty}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Simpan Urutan
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([1, 2, 3] as const).map((act) => {
          const actBeats = beats.filter((b) => b.act === act).sort((a, b) => a.order - b.order);
          const columnKey = `col-${act}`;

          return (
            <div
              key={act}
              className={cn(
                'flex min-h-[200px] flex-col gap-2 rounded-lg border bg-muted/20 p-2',
                dragOverKey === columnKey && 'ring-2 ring-primary/40'
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverKey(columnKey);
              }}
              onDragLeave={() => setDragOverKey((k) => (k === columnKey ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(act, actBeats.length);
              }}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-foreground">{ACT_LABEL[act]}</span>
                <Badge variant="secondary">{actBeats.length}</Badge>
              </div>

              {actBeats.map((beat, index) => {
                const cardKey = `${act}-${index}`;
                return (
                  <div
                    key={beat.id}
                    draggable
                    onDragStart={() => setDraggingId(beat.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverKey(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverKey(cardKey);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDrop(act, index);
                    }}
                    className={cn(
                      'cursor-grab space-y-1.5 rounded-md border bg-card p-2.5 active:cursor-grabbing',
                      draggingId === beat.id && 'opacity-40',
                      dragOverKey === cardKey && 'border-primary'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                            TYPE_COLOR[beat.type]
                          )}
                        >
                          {beat.type}
                        </span>
                        <Badge variant="outline" className="font-normal">
                          {STAKES_LABEL[beat.stakes]}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => removeBeat(beat.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>

                    <Textarea
                      value={beat.description}
                      onChange={(e) => updateBeat(beat.id, { description: e.target.value })}
                      rows={2}
                      className="text-xs"
                      placeholder="Apa yang terjadi di beat ini?"
                    />

                    {beat.characters.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {beat.characters.map((c) => (
                          <Badge key={c} variant="outline" className="font-normal">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 justify-start text-muted-foreground"
                onClick={() => addBeat(act)}
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah beat
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
