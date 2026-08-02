/**
 * Episode status from database
 */
export type EpisodeStatus = 
  | 'PLANNING'
  | 'GENERATING'
  | 'REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'ARCHIVED';

/**
 * Episode from database (minimal fields needed for visualizer)
 */
export interface Episode {
  id: string;
  universeId: string;
  seasonId: string;
  episodeNumber: number;
  title: string;
  premise: string;
  status: EpisodeStatus;
  plan: Record<string, unknown> | null;
  targetScenes: number;
  createdAt: string;
  updatedAt: string;
  season?: { id: string; seasonNumber: number; title: string };
  scenes?: any[];
  _count?: { scenes: number };
}

/**
 * Season arc types (mirrored from engine-v2)
 */
export type SeasonArcType = 
  | 'serialized'      // Continuous story across episodes
  | 'episodic'        // Standalone episodes with loose connections
  | 'anthology'       // Each episode different story/characters
  | 'hybrid';         // Mix of serialized and episodic

/**
 * Character season arc (mirrored from engine-v2)
 */
export interface CharacterSeasonArc {
  characterId: string;
  arcType: 'growth' | 'decline' | 'redemption' | 'corruption' | 'discovery' | 'static';
  startState: string;
  endState: string;
  milestones: Array<{
    episodeNumber: number;
    description: string;
    beatType: string;
  }>;
  keyEpisodes: number[];
  description: string;
}

/**
 * Season theme progression (mirrored from engine-v2)
 */
export interface SeasonTheme {
  theme: string;
  description: string;
  episodes: number[]; // Which episodes explore this theme
  weight: number; // 0-1, how central to season
  evolution: 'introduce' | 'develop' | 'climax' | 'resolve';
}

/**
 * Season act structure (mirrored from engine-v2)
 */
export interface SeasonAct {
  number: number;
  title: string;
  description: string;
  episodeRange: [number, number]; // inclusive
  theme: string;
  turningPoint: string; // Episode number where act turns
}

/**
 * Episode summary (mirrored from engine-v2)
 */
export interface EpisodeSummary {
  number: number;
  title: string;
  logline: string;
  summary: string;
  themes: string[];
  focusCharacters: string[];
  estimatedRuntime: number;
  actBreaks: number[];
  keyBeats: string[];
}

/**
 * Season structure overview (mirrored from engine-v2)
 */
export interface SeasonStructure {
  id: string;
  universeId: string;
  seasonNumber: number;
  title: string;
  logline: string;
  arcType: SeasonArcType;
  episodeCount: number;
  targetRuntimeMinutes: number;
  themes: SeasonTheme[];
  characterArcs: CharacterSeasonArc[];
  episodes: EpisodeSummary[];
  actStructure: SeasonAct[];
  metadata: {
    createdAt: string;
    version: number;
    source: 'generated' | 'manual' | 'hybrid';
  };
}

/**
 * Extended episode with status from database
 */
export interface VisualizerEpisode extends EpisodeSummary {
  status: EpisodeStatus;
  episodeId: string; // Database ID for navigation
}

/**
 * Character arc with visual positioning data
 */
export interface VisualizerCharacterArc extends CharacterSeasonArc {
  color: string;
  milestones: Array<{
    episodeNumber: number;
    description: string;
    beatType: string;
    xPosition: number; // 0-100 percentage
    yPosition: number; // 0-100 percentage within track
  }>;
  keyEpisodes: number[];
}

/**
 * Theme track with visual data
 */
export interface VisualizerThemeTrack extends SeasonTheme {
  color: string;
  episodesData: Array<{
    episodeNumber: number;
    intensity: number; // 0-1 based on weight + evolution stage
  }>;
}

/**
 * Props for SeasonArcVisualizer component
 */
export interface SeasonArcVisualizerProps {
  /** Season plan structure from engine-v2 (stored in Season.plan) */
  seasonPlan: SeasonStructure;
  /** Episodes from database (for status badges) */
  episodes: Episode[];
  /** Callback when episode card is clicked */
  onEpisodeClick?: (episodeNumber: number, episodeId: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show compact version (for dashboard cards) */
  compact?: boolean;
}

/**
 * Episode status color mapping
 */
export const EPISODE_STATUS_COLORS: Record<EpisodeStatus, string> = {
  PLANNING: 'bg-gray-400',
  GENERATING: 'bg-blue-500',
  REVIEW: 'bg-yellow-500',
  APPROVED: 'bg-green-500',
  PUBLISHED: 'bg-purple-500',
  ARCHIVED: 'bg-gray-600',
};

/**
 * Episode status label mapping
 */
export const EPISODE_STATUS_LABELS: Record<EpisodeStatus, string> = {
  PLANNING: 'Planning',
  GENERATING: 'Generating',
  REVIEW: 'Review',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

/**
 * Arc type color mapping
 */
export const ARC_TYPE_COLORS: Record<CharacterSeasonArc['arcType'], string> = {
  growth: 'bg-emerald-500',
  decline: 'bg-red-500',
  redemption: 'bg-amber-500',
  corruption: 'bg-rose-500',
  discovery: 'bg-blue-500',
  static: 'bg-gray-500',
};

/**
 * Theme evolution color mapping
 */
export const THEME_EVOLUTION_COLORS: Record<SeasonTheme['evolution'], string> = {
  introduce: 'bg-sky-500',
  develop: 'bg-blue-500',
  climax: 'bg-indigo-500',
  resolve: 'bg-purple-500',
};

/**
 * Season arc type color mapping
 */
export const SEASON_ARC_TYPE_COLORS: Record<SeasonArcType, string> = {
  serialized: 'bg-blue-500',
  episodic: 'bg-green-500',
  anthology: 'bg-purple-500',
  hybrid: 'bg-amber-500',
};

/**
 * Generate color palette for visual tracks
 */
export const VISUALIZER_COLORS = [
  '#22c55e', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
];

/**
 * Get color for index (cycles through palette)
 */
export function getVisualizerColor(index: number): string {
  return VISUALIZER_COLORS[index % VISUALIZER_COLORS.length];
}

/**
 * Calculate episode position in timeline (0-100)
 */
export function getEpisodePosition(episodeNumber: number, totalEpisodes: number): number {
  if (totalEpisodes <= 1) return 50;
  return ((episodeNumber - 1) / (totalEpisodes - 1)) * 100;
}

/**
 * Calculate act boundaries positions
 */
export function getActBoundaries(acts: SeasonAct[], totalEpisodes: number): Array<{ actNumber: number; start: number; end: number; label: string }> {
  return acts.map(act => ({
    actNumber: act.number,
    start: getEpisodePosition(act.episodeRange[0], totalEpisodes),
    end: getEpisodePosition(act.episodeRange[1], totalEpisodes),
    label: act.title,
  }));
}

/**
 * Calculate theme intensity for an episode based on evolution stage
 */
export function getThemeIntensity(theme: SeasonTheme, episodeNumber: number): number {
  const episodeIndex = theme.episodes.indexOf(episodeNumber);
  if (episodeIndex === -1) return 0;
  
  const baseIntensity = theme.weight; // 0-1
  const evolutionMultiplier: Record<SeasonTheme['evolution'], number> = {
    introduce: 0.3 + (episodeIndex / Math.max(theme.episodes.length - 1, 1)) * 0.4,
    develop: 0.5 + (episodeIndex / Math.max(theme.episodes.length - 1, 1)) * 0.3,
    climax: 0.7 + (episodeIndex / Math.max(theme.episodes.length - 1, 1)) * 0.3,
    resolve: 0.6 - (episodeIndex / Math.max(theme.episodes.length - 1, 1)) * 0.4,
  };
  
  return Math.min(1, baseIntensity * evolutionMultiplier[theme.evolution]);
}
