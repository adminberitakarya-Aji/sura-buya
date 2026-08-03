/**
 * VF-2.6 — Studio Project Workspace
 *
 * Main workspace for a video project. Shows script and storyboard tabs.
 * Script tab: input story idea → generate script via AI
 * Storyboard tab: generate shot list from script
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { studioApi } from '@/lib/api-client';
import { FileText, LayoutGrid, Sparkles, AlertCircle } from 'lucide-react';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const universeId = params.universeId as string;
  const projectId = params.projectId as string;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'script' | 'storyboard'>('script');
  const [storyIdea, setStoryIdea] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['studio-project', universeId, projectId],
    queryFn: () => studioApi.getProject(universeId, projectId),
  });

  const generateScriptMutation = useMutation({
    mutationFn: () => studioApi.generateScript(universeId, projectId, { storyIdea }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-project', universeId, projectId] });
    },
  });

  const generateStoryboardMutation = useMutation({
    mutationFn: () => studioApi.generateStoryboard(universeId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-project', universeId, projectId] });
    },
  });

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Memuat project...</div>;
  }

  const project = data?.project;

  if (!project) {
    return <div className="text-center py-12 text-muted-foreground">Project tidak ditemukan.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <div className="flex items-center gap-3 mt-2">
          {project.character && (
            <span className="text-sm text-muted-foreground">
              Karakter: {project.character.displayName}
            </span>
          )}
          {project.series && (
            <span className="text-sm text-muted-foreground">
              Series: {project.series.title}
              {project.episodeOrder ? ` · Ep ${project.episodeOrder}` : ''}
            </span>
          )}
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium">
            {project.status}
          </span>
          <span className="text-xs text-muted-foreground">
            {(project.settings as any)?.targetDuration ?? 15}s
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('script')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'script' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          <FileText className="h-4 w-4" />
          Script
        </button>
        <button
          onClick={() => setActiveTab('storyboard')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'storyboard' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Storyboard
        </button>
      </div>

      {/* Script Tab */}
      {activeTab === 'script' && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Ide Cerita</label>
            <textarea
              value={storyIdea}
              onChange={(e) => setStoryIdea(e.target.value)}
              placeholder="Ceritakan ide cerita untuk video ini... Mis. Suro menemukan harta karun di dasar laut, tapi hiu besar menghalanginya."
              rows={4}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => generateScriptMutation.mutate()}
            disabled={!storyIdea || storyIdea.length < 5 || generateScriptMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {generateScriptMutation.isPending ? 'Generating...' : 'Generate Script'}
          </button>

          {generateScriptMutation.isError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              Error: {(generateScriptMutation.error as Error).message}
            </div>
          )}

          {project.script && (
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-2">Naskah</h3>
              <pre className="whitespace-pre-wrap text-sm font-mono">{project.script}</pre>
            </div>
          )}
        </div>
      )}

      {/* Storyboard Tab */}
      {activeTab === 'storyboard' && (
        <div className="space-y-4">
          {!project.script ? (
            <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Generate script terlebih dahulu sebelum membuat storyboard.
            </div>
          ) : (
            <>
              <button
                onClick={() => generateStoryboardMutation.mutate()}
                disabled={generateStoryboardMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {generateStoryboardMutation.isPending ? 'Generating...' : 'Generate Storyboard'}
              </button>

              {generateStoryboardMutation.isError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  Error: {(generateStoryboardMutation.error as Error).message}
                </div>
              )}

              {project.storyboard && Array.isArray(project.storyboard) && project.storyboard.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Shot List ({project.storyboard.length} shots)</h3>
                  {project.storyboard.map((shot: any, i: number) => (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">Shot {shot.index + 1}</span>
                        <div className="flex gap-2">
                          <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                            {shot.cameraAngle}
                          </span>
                          <span className="text-xs text-muted-foreground">{shot.duration}s</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{shot.action}</p>
                      {shot.dialogue && (
                        <p className="text-sm mt-1 italic">
                          &ldquo;{shot.dialogue.line}&rdquo;
                        </p>
                      )}
                      {shot.visualPrompt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <span className="font-medium">Visual:</span> {shot.visualPrompt}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}