import type { EpisodeStatus, SceneStatus } from '@/lib/api-client';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

export const EPISODE_STATUS_BADGE: Record<EpisodeStatus, BadgeVariant> = {
  PLANNING: 'outline',
  GENERATING: 'secondary',
  REVIEW: 'secondary',
  APPROVED: 'default',
  PUBLISHED: 'default',
  ARCHIVED: 'outline',
};

export const SCENE_STATUS_BADGE: Record<SceneStatus, BadgeVariant> = {
  DRAFT: 'outline',
  GENERATED: 'secondary',
  VALIDATED: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
};

export const EPISODE_STATUS_LABEL: Record<EpisodeStatus, string> = {
  PLANNING: 'Planning',
  GENERATING: 'Generating',
  REVIEW: 'Review',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export const SCENE_STATUS_LABEL: Record<SceneStatus, string> = {
  DRAFT: 'Draft',
  GENERATED: 'Generated',
  VALIDATED: 'Validated',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};
