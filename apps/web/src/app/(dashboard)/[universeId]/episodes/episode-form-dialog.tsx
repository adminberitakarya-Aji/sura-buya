'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Textarea,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@suro-buya/ui';
import { Loader2 } from 'lucide-react';
import type { Episode, Season } from '@/lib/api-client';

export interface EpisodeFormValues {
  seasonId: string;
  episodeNumber: number;
  title: string;
  premise: string;
  targetScenes: number;
}

interface EpisodeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episode: Episode | null;
  seasons: Season[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (values: EpisodeFormValues) => void;
  onCreateSeason: (title: string) => Promise<Season>;
}

const EMPTY_VALUES: EpisodeFormValues = {
  seasonId: '',
  episodeNumber: 1,
  title: '',
  premise: '',
  targetScenes: 6,
};

export function EpisodeFormDialog({
  open,
  onOpenChange,
  episode,
  seasons,
  isSubmitting,
  error,
  onSubmit,
  onCreateSeason,
}: EpisodeFormDialogProps) {
  const [values, setValues] = useState<EpisodeFormValues>(EMPTY_VALUES);
  const [creatingSeason, setCreatingSeason] = useState(false);
  const [newSeasonTitle, setNewSeasonTitle] = useState('');
  const [seasonError, setSeasonError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (episode) {
      setValues({
        seasonId: episode.seasonId,
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        premise: episode.premise,
        targetScenes: episode.targetScenes,
      });
    } else {
      setValues({ ...EMPTY_VALUES, seasonId: seasons[0]?.id ?? '' });
    }
    setCreatingSeason(false);
    setNewSeasonTitle('');
    setSeasonError(null);
  }, [open, episode, seasons]);

  async function handleCreateSeason() {
    if (!newSeasonTitle.trim()) return;
    setSeasonError(null);
    try {
      const season = await onCreateSeason(newSeasonTitle.trim());
      setValues((v) => ({ ...v, seasonId: season.id }));
      setCreatingSeason(false);
      setNewSeasonTitle('');
    } catch (err) {
      setSeasonError(err instanceof Error ? err.message : 'Gagal membuat season');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  const isValid = values.seasonId && values.title.trim() && values.premise.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{episode ? 'Edit Episode' : 'Episode Baru'}</DialogTitle>
          <DialogDescription>
            {episode
              ? 'Perbarui detail episode ini.'
              : 'Buat episode baru untuk direncanakan dan digenerate.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="season">Season</Label>
            {!creatingSeason ? (
              <div className="flex gap-2">
                <Select
                  value={values.seasonId || undefined}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, seasonId: v }))}
                  disabled={Boolean(episode)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih season..." />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        S{s.seasonNumber} — {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!episode && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreatingSeason(true)}
                  >
                    Baru
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Judul season, contoh: Jawa Timur"
                  value={newSeasonTitle}
                  onChange={(e) => setNewSeasonTitle(e.target.value)}
                />
                <Button type="button" onClick={handleCreateSeason}>
                  Simpan
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCreatingSeason(false)}>
                  Batal
                </Button>
              </div>
            )}
            {seasonError && <p className="text-xs text-destructive">{seasonError}</p>}
            {seasons.length === 0 && !creatingSeason && (
              <p className="text-xs text-muted-foreground">
                Belum ada season. Klik &ldquo;Baru&rdquo; untuk membuat season pertama.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="episodeNumber">Nomor Episode</Label>
              <Input
                id="episodeNumber"
                type="number"
                min={1}
                value={values.episodeNumber}
                onChange={(e) =>
                  setValues((v) => ({ ...v, episodeNumber: Number(e.target.value) || 1 }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetScenes">Target Scene</Label>
              <Input
                id="targetScenes"
                type="number"
                min={1}
                value={values.targetScenes}
                onChange={(e) =>
                  setValues((v) => ({ ...v, targetScenes: Number(e.target.value) || 1 }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Judul Episode</Label>
            <Input
              id="title"
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
              placeholder="Petualangan di Pelabuhan"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="premise">Premise</Label>
            <Textarea
              id="premise"
              value={values.premise}
              onChange={(e) => setValues((v) => ({ ...v, premise: e.target.value }))}
              placeholder="Ringkasan singkat konflik dan tujuan episode ini..."
              rows={4}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {episode ? 'Simpan Perubahan' : 'Buat Episode'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
