'use client';

import * as React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2,
  HelpCircle,
  Target,
  Users,
  Layers,
  type LucideIcon
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type {
  SeasonArcVisualizerProps,
  SeasonStructure,
  Episode,
  CharacterSeasonArc,
  SeasonTheme,
  SeasonAct,
  EpisodeStatus,
  VisualizerCharacterArc,
  VisualizerThemeTrack,
} from './types';
import {
  EPISODE_STATUS_COLORS,
  EPISODE_STATUS_LABELS,
  ARC_TYPE_COLORS,
  THEME_EVOLUTION_COLORS,
  SEASON_ARC_TYPE_COLORS,
  VISUALIZER_COLORS,
  getVisualizerColor,
  getEpisodePosition,
  getActBoundaries,
  getThemeIntensity,
} from './types';

const TRACK_HEIGHT = 60;
const EPISODE_CARD_WIDTH = 140;
const EPISODE_CARD_HEIGHT = 200;
const CHARACTER_TRACK_HEIGHT = 50;
const THEME_TRACK_HEIGHT = 30;

interface SeasonArcVisualizerState {
  scrollLeft: number;
  isFullscreen: boolean;
}

export function SeasonArcVisualizer({
  seasonPlan,
  episodes,
  onEpisodeClick,
  className,
  compact = false,
}: SeasonArcVisualizerProps) {
  const [state, setState] = React.useState<SeasonArcVisualizerState>({
    scrollLeft: 0,
    isFullscreen: false,
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);

  // Prepare data for rendering
  const episodeCount = seasonPlan.episodeCount;
  const totalEpisodes = Math.max(episodeCount, episodes.length);
  
  // Merge plan episodes with database episodes for status
  const mergedEpisodes = seasonPlan.episodes.map((planEp, index) => {
    const dbEpisode = episodes.find(e => e.episodeNumber === planEp.number);
    return {
      ...planEp,
      status: dbEpisode?.status ?? 'PLANNING',
      episodeId: dbEpisode?.id ?? `ep-${planEp.number}`,
    };
  });

  // Prepare character arcs with visual data
  const characterArcs = React.useMemo((): VisualizerCharacterArc[] => {
    return seasonPlan.characterArcs.map((arc, index) => {
      const color = getVisualizerColor(index);
      const milestones = arc.milestones.map((ms, msIndex) => ({
        ...ms,
        xPosition: getEpisodePosition(ms.episodeNumber, totalEpisodes),
        yPosition: (msIndex / Math.max(arc.milestones.length - 1, 1)) * 80 + 10,
      }));
      return {
        ...arc,
        color,
        milestones,
        keyEpisodes: arc.keyEpisodes,
      };
    });
  }, [seasonPlan.characterArcs, totalEpisodes]);

  // Prepare theme tracks with visual data
  const themeTracks = React.useMemo((): VisualizerThemeTrack[] => {
    return seasonPlan.themes.map((theme, index) => {
      const color = getVisualizerColor(index + characterArcs.length);
      const episodesData = theme.episodes.map(epNum => ({
        episodeNumber: epNum,
        intensity: getThemeIntensity(theme, epNum),
      }));
      return {
        ...theme,
        color,
        episodesData,
      };
    });
  }, [seasonPlan.themes, characterArcs.length]);

  // Prepare act boundaries
  const actBoundaries = React.useMemo(() => 
    getActBoundaries(seasonPlan.actStructure, totalEpisodes),
    [seasonPlan.actStructure, totalEpisodes]
  );

  // Scroll handlers
  const scrollLeft = () => {
    if (timelineRef.current) {
      timelineRef.current.scrollBy({ left: -EPISODE_CARD_WIDTH * 2, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (timelineRef.current) {
      timelineRef.current.scrollBy({ left: EPISODE_CARD_WIDTH * 2, behavior: 'smooth' });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setState(prev => ({ ...prev, scrollLeft: e.currentTarget.scrollLeft }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollLeft();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollRight();
    }
  };

  const toggleFullscreen = () => {
    setState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  };

  // Episode status badge
  const renderStatusBadge = (status: EpisodeStatus) => (
    <Badge className={cn(EPISODE_STATUS_COLORS[status], 'text-xs')}>
      {EPISODE_STATUS_LABELS[status]}
    </Badge>
  );

  // Arc type badge
  const renderArcTypeBadge = (arcType: SeasonStructure['arcType']) => (
    <Badge className={cn(SEASON_ARC_TYPE_COLORS[arcType], 'text-xs capitalize')}>
      {arcType}
    </Badge>
  );

  if (compact) {
    return renderCompactView();
  }

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col bg-card border rounded-xl overflow-hidden',
          state.isFullscreen && 'fixed inset-0 z-50 h-screen w-screen',
          className
        )}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Season Arc Visualizer"
      >
        {/* Header */}
        <div className={cn(
          'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border-b',
          state.isFullscreen && 'bg-card'
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {seasonPlan.title}
              </h2>
              <p className="text-sm text-muted-foreground">{seasonPlan.logline}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                Season {seasonPlan.seasonNumber} • {seasonPlan.episodeCount} Episodes
              </span>
              {renderArcTypeBadge(seasonPlan.arcType)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-2 rounded-lg hover:bg-accent transition-colors"
                  aria-label="Keyboard shortcuts"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                <div className="space-y-1 text-sm">
                  <p><kbd className="px-1.5 py-0.5 bg-muted rounded">←</kbd> Scroll left</p>
                  <p><kbd className="px-1.5 py-0.5 bg-muted rounded">→</kbd> Scroll right</p>
                  <p><kbd className="px-1.5 py-0.5 bg-muted rounded">Click</kbd> Episode to edit</p>
                </div>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg hover:bg-accent transition-colors"
                  aria-label={state.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {state.isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {state.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Act Structure Bar */}
          <div className="border-b bg-muted/30 px-4 py-2 overflow-x-auto">
            <div 
              className="flex h-10 relative"
              style={{ minWidth: `${totalEpisodes * EPISODE_CARD_WIDTH}px` }}
            >
              {actBoundaries.map((act, actIndex) => (
                <div
                  key={act.actNumber}
                  className="absolute top-0 bottom-0 flex items-center justify-center px-2 text-xs font-medium text-muted-foreground border-r border-border/50"
                  style={{
                    left: `${act.start}%`,
                    width: `${act.end - act.start}%`,
                    zIndex: 1,
                    backgroundColor: actIndex % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                  }}
                >
                  {act.label}
                </div>
              ))}
              {/* Vertical act dividers */}
              {actBoundaries.slice(0, -1).map((act) => (
                <div
                  key={`divider-${act.actNumber}`}
                  className="absolute top-0 bottom-0 w-px bg-destructive/50"
                  style={{ left: `${act.end}%`, zIndex: 2 }}
                />
              ))}
            </div>
          </div>

          {/* Theme Tracks */}
          {themeTracks.length > 0 && (
            <div className="border-b bg-muted/20 px-4 py-2 overflow-x-auto">
              <div 
                className="flex min-h-[80px] gap-2"
                style={{ minWidth: `${totalEpisodes * EPISODE_CARD_WIDTH}px` }}
              >
                {themeTracks.map((theme, index) => (
                  <div
                    key={theme.theme}
                    className="flex-1 relative"
                    style={{ minWidth: `${totalEpisodes * EPISODE_CARD_WIDTH}px` }}
                  >
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-border/50" />
                    {theme.episodesData.map((epData) => (
                      <Tooltip key={epData.episodeNumber}>
                        <TooltipTrigger asChild>
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-200 hover:scale-150"
                            style={{
                              left: `${getEpisodePosition(epData.episodeNumber, totalEpisodes)}%`,
                              backgroundColor: theme.color,
                              opacity: 0.3 + epData.intensity * 0.7,
                              transform: `translate(-50%, -50%) scale(${0.5 + epData.intensity})`,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="font-medium">{theme.theme}</div>
                          <div className="text-sm text-muted-foreground">
                            Episode {epData.episodeNumber} • Intensity: {Math.round(epData.intensity * 100)}%
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {theme.evolution.charAt(0).toUpperCase() + theme.evolution.slice(1)} phase
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {/* Theme label on the left */}
                    <div className="absolute left-[-120px] top-0 h-full flex items-center text-xs font-medium text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: theme.color }}
                        />
                        {theme.theme}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Episode Timeline */}
          <div
            ref={timelineRef}
            className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-4"
            onScroll={handleScroll}
          >
            <div
              className="flex items-start gap-3"
              style={{ minWidth: `${totalEpisodes * EPISODE_CARD_WIDTH}px` }}
              role="list"
              aria-label="Episode timeline"
            >
              {mergedEpisodes.map((ep, index) => (
                <EpisodeCard
                  key={ep.number}
                  episode={ep}
                  index={index}
                  totalEpisodes={totalEpisodes}
                  onClick={onEpisodeClick}
                  actBoundaries={actBoundaries}
                />
              ))}
              {/* Empty slots for remaining episodes if plan has more than DB episodes */}
              {Array.from({ length: Math.max(0, episodeCount - mergedEpisodes.length) }).map((_, i) => (
                <EmptyEpisodeSlot
                  key={`empty-${mergedEpisodes.length + i}`}
                  episodeNumber={mergedEpisodes.length + i + 1}
                  totalEpisodes={totalEpisodes}
                  actBoundaries={actBoundaries}
                />
              ))}
            </div>
          </div>

          {/* Character Arc Tracks */}
          {characterArcs.length > 0 && (
            <div className="border-t bg-muted/20 px-4 py-4 overflow-x-auto">
              <div className="flex min-h-[200px] gap-4" style={{ minWidth: `${totalEpisodes * EPISODE_CARD_WIDTH}px` }}>
                {/* Character labels sidebar */}
                <div className="flex flex-col gap-4 w-40 flex-shrink-0">
                  {characterArcs.map((arc, index) => (
                    <div key={arc.characterId} className="relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-2 text-right pr-4">
                            <div className="flex items-center justify-end gap-1 text-xs">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: arc.color }} />
                              <span className="font-medium truncate">{arc.characterId}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 capitalize">{arc.arcType}</div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-sm">
                          <div className="font-medium">{arc.characterId}</div>
                          <div className="text-sm text-muted-foreground">{arc.description}</div>
                          <div className="mt-1 flex gap-1">
                            <Badge variant="outline" className={cn(ARC_TYPE_COLORS[arc.arcType], 'text-xs')}>
                              {arc.arcType}
                            </Badge>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
                
                {/* Character tracks */}
                <div className="flex-1 relative" style={{ minWidth: `${totalEpisodes * EPISODE_CARD_WIDTH}px` }}>
                  {/* Track lines */}
                  {characterArcs.map((arc, trackIndex) => (
                    <div
                      key={arc.characterId}
                      className="absolute left-0 right-0 flex items-center"
                      style={{ top: `${trackIndex * CHARACTER_TRACK_HEIGHT + CHARACTER_TRACK_HEIGHT / 2}px` }}
                    >
                      <div className="w-full h-px bg-border/50" />
                    </div>
                  ))}
                  
                  {/* Milestones */}
                  {characterArcs.map((arc, trackIndex) => (
                    <div
                      key={arc.characterId}
                      className="absolute left-0 right-0"
                      style={{ top: `${trackIndex * CHARACTER_TRACK_HEIGHT}px`, height: `${CHARACTER_TRACK_HEIGHT}px` }}
                    >
                      {arc.milestones.map((milestone, msIndex) => (
                        <Tooltip key={`${arc.characterId}-${milestone.episodeNumber}`}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-all duration-200 hover:scale-150 cursor-pointer"
                              style={{
                                left: `${milestone.xPosition}%`,
                                backgroundColor: arc.color,
                                borderColor: arc.color,
                                zIndex: 10,
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm">
                            <div className="font-medium">{arc.characterId}</div>
                            <div className="text-sm text-muted-foreground">Episode {milestone.episodeNumber}</div>
                            <div className="text-xs text-muted-foreground mt-1">{milestone.description}</div>
                            <div className="text-xs text-muted-foreground mt-1">{milestone.beatType}</div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {/* Connecting line between milestones */}
                      {arc.milestones.length > 1 && (
                        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-px" style={{ backgroundColor: `${arc.color}80` }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="border-t px-4 py-3 bg-muted/30 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium">Episode Status:</span>
              {(Object.keys(EPISODE_STATUS_COLORS) as EpisodeStatus[]).map(status => (
                <Badge key={status} className={cn(EPISODE_STATUS_COLORS[status], 'text-[10px] px-1.5 py-0.5')}>
                  {EPISODE_STATUS_LABELS[status].charAt(0)}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Arc Types:</span>
              {['growth', 'decline', 'redemption', 'corruption', 'discovery', 'static'].map(type => (
                <Badge key={type} variant="outline" className={cn(ARC_TYPE_COLORS[type as CharacterSeasonArc['arcType']], 'text-[10px] px-1.5 py-0.5')}>
                  {type.charAt(0).toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );

  // Compact view for dashboard cards
  function renderCompactView() {
    return (
      <div className={cn('bg-card border rounded-lg p-4', className)}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-sm">{seasonPlan.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{seasonPlan.logline}</p>
          </div>
          <div className="flex items-center gap-1">
            {renderArcTypeBadge(seasonPlan.arcType)}
            <Badge variant="outline" className="text-xs">
              {seasonPlan.episodeCount} eps
            </Badge>
          </div>
        </div>
        
        {/* Mini timeline */}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-1" style={{ minWidth: `${totalEpisodes * 60}px` }}>
            {mergedEpisodes.map((ep) => (
              <Tooltip key={ep.number}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors cursor-pointer min-w-[50px]',
                      EPISODE_STATUS_COLORS[ep.status],
                      'text-white'
                    )}
                    onClick={() => onEpisodeClick?.(ep.number, ep.episodeId)}
                  >
                    <span className="text-[10px] font-medium">Ep {ep.number}</span>
                    <span className="text-[9px] opacity-80 truncate max-w-[48px]">{ep.title}</span>
                    <span className="text-[8px] px-1 rounded">{EPISODE_STATUS_LABELS[ep.status].charAt(0)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="font-medium">{ep.title}</div>
                  <div className="text-sm text-muted-foreground">{ep.logline}</div>
                  <div className="text-xs text-muted-foreground mt-1">Status: {EPISODE_STATUS_LABELS[ep.status]}</div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Mini theme indicators */}
        {themeTracks.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {themeTracks.slice(0, 4).map((theme, index) => (
              <Badge 
                key={theme.theme} 
                variant="outline" 
                className="text-[10px] px-1.5 py-0.5"
                style={{ borderColor: theme.color, color: theme.color }}
              >
                {theme.theme}
              </Badge>
            ))}
            {themeTracks.length > 4 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                +{themeTracks.length - 4} more
              </Badge>
            )}
          </div>
        )}

        {/* Mini character arcs */}
        {characterArcs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {characterArcs.slice(0, 3).map((arc) => (
              <Badge 
                key={arc.characterId} 
                variant="outline" 
                className="text-[10px] px-1.5 py-0.5"
                style={{ borderColor: arc.color, color: arc.color }}
              >
                {arc.characterId}
              </Badge>
            ))}
            {characterArcs.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                +{characterArcs.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }
}

// Episode Card Component
interface EpisodeCardProps {
  episode: {
    number: number;
    title: string;
    logline: string;
    summary: string;
    themes: string[];
    focusCharacters: string[];
    estimatedRuntime: number;
    actBreaks: number[];
    keyBeats: string[];
    status: EpisodeStatus;
    episodeId: string;
  };
  index: number;
  totalEpisodes: number;
  onClick?: (episodeNumber: number, episodeId: string) => void;
  actBoundaries: Array<{ actNumber: number; start: number; end: number; label: string }>;
}

function EpisodeCard({ episode, index, totalEpisodes, onClick, actBoundaries }: EpisodeCardProps) {
  const position = getEpisodePosition(episode.number, totalEpisodes);
  const currentAct = actBoundaries.find(
    act => episode.number >= actBoundaries[act.actNumber - 1]?.start && 
           episode.number <= actBoundaries[act.actNumber - 1]?.end
  )?.actNumber ?? 1;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex flex-col gap-2 p-3 rounded-xl border transition-all duration-200 cursor-pointer min-w-[140px] max-w-[160px]',
            'hover:shadow-lg hover:border-primary/50',
            EPISODE_STATUS_COLORS[episode.status],
            'text-white'
          )}
          style={{ 
            flexShrink: 0,
            minWidth: '140px',
          }}
          onClick={() => onClick?.(episode.number, episode.episodeId)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick?.(episode.number, episode.episodeId);
            }
          }}
        >
          {/* Episode number and act badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">Ep {episode.number}</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
              Act {currentAct}
            </Badge>
          </div>

          {/* Title */}
          <h4 className="font-medium text-sm truncate">{episode.title}</h4>

          {/* Logline */}
          <p className="text-xs opacity-80 line-clamp-2">{episode.logline}</p>

          {/* Themes */}
          {episode.themes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {episode.themes.slice(0, 3).map((theme) => (
                <Badge key={theme} variant="outline" className="text-[9px] px-1.5 py-0.5 border-current/50 text-current">
                  {theme}
                </Badge>
              ))}
              {episode.themes.length > 3 && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-current/50 text-current">
                  +{episode.themes.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Focus characters */}
          {episode.focusCharacters.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {episode.focusCharacters.slice(0, 2).map((char) => (
                <Badge key={char} variant="outline" className="text-[9px] px-1.5 py-0.5 border-current/50 text-current">
                  {char}
                </Badge>
              ))}
              {episode.focusCharacters.length > 2 && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-current/50 text-current">
                  +{episode.focusCharacters.length - 2}
                </Badge>
              )}
            </div>
          )}

          {/* Runtime and beats */}
          <div className="flex items-center justify-between text-xs opacity-70 pt-1">
            <span>{episode.estimatedRuntime} min</span>
            <span>{episode.keyBeats.length} beats</span>
          </div>

          {/* Status badge */}
          <div className="pt-1">
            <Badge className={cn(EPISODE_STATUS_COLORS[episode.status], 'text-[9px] w-full')}>
              {EPISODE_STATUS_LABELS[episode.status]}
            </Badge>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <div className="space-y-2">
          <div>
            <h4 className="font-medium">Episode {episode.number}: {episode.title}</h4>
            <p className="text-sm text-muted-foreground">{episode.logline}</p>
          </div>
          <div className="text-sm">
            <p>{episode.summary}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {episode.themes.map((theme) => (
              <Badge key={theme} variant="outline" className="text-xs">{theme}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {episode.focusCharacters.map((char) => (
              <Badge key={char} variant="secondary" className="text-xs">{char}</Badge>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>⏱ {episode.estimatedRuntime} min</span>
            <span>🎭 Act {currentAct}</span>
            <span>💥 {episode.keyBeats.length} beats</span>
          </div>
          <div className="pt-2 border-t">
            <Badge className={cn(EPISODE_STATUS_COLORS[episode.status], 'text-xs')}>
              {EPISODE_STATUS_LABELS[episode.status]}
            </Badge>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Empty Episode Slot Component
interface EmptyEpisodeSlotProps {
  episodeNumber: number;
  totalEpisodes: number;
  actBoundaries: Array<{ actNumber: number; start: number; end: number; label: string }>;
}

function EmptyEpisodeSlot({ episodeNumber, totalEpisodes, actBoundaries }: EmptyEpisodeSlotProps) {
  const currentAct = actBoundaries.find(
    act => episodeNumber >= actBoundaries[act.actNumber - 1]?.start && 
           episodeNumber <= actBoundaries[act.actNumber - 1]?.end
  )?.actNumber ?? 1;

  return (
    <div className={cn(
      'flex flex-col gap-2 p-3 rounded-xl border-2 border-dashed min-w-[140px] max-w-[160px]',
      'bg-muted/30 text-muted-foreground/50'
    )} style={{ flexShrink: 0, minWidth: '140px' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Ep {episodeNumber}</span>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5">
          Act {currentAct}
        </Badge>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs italic">Not planned yet</span>
      </div>
      <Badge variant="outline" className="text-[9px] w-full">
        PLANNING
      </Badge>
    </div>
  );
}