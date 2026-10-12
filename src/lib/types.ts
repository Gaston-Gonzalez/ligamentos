export type AttendanceStatus =
  | "present"
  | "absent"
  | "injury"
  | "travel"
  | "not_registered";

export type MatchResult = "W" | "D" | "L";

export interface SeedChampionship {
  name: string;
  slug: string;
  series?: string | null;
  division?: string | null;
  ligaproUrl?: string | null;
  ligaproGalleryUrl?: string | null;
}

/** Avatar crop: x/y are % offsets from center; zoom is scale (1–3). */
export interface PhotoCrop {
  x: number;
  y: number;
  zoom: number;
}

export interface SeedPlayer {
  name: string;
  slug: string;
  aliases?: string[];
  number?: number | null;
  position?: string | null;
  photoUrl?: string | null;
  photoCrop?: PhotoCrop | null;
  active?: boolean;
}

export interface SeedMatch {
  index: number;
  rival: string;
  championship: string;
  pitch: number | null;
  result: MatchResult | null;
  goalsFor: number;
  goalsAgainst: number;
  date: string | null;
  attendanceLabel?: string;
  jornada?: number | null;
  youtubeUrl?: string | null;
  ligaproAlbumId?: string | null;
  ligaproAlbumUrl?: string | null;
  notes?: string | null;
}

export interface SeedAttendance {
  matchIndex: number;
  player: string;
  status: string;
}

export interface SeedGoal {
  matchIndex: number;
  player: string | null;
  isOwnGoal: boolean;
}

export interface SeedPhoto {
  imageUrl: string;
  sourcePageUrl?: string | null;
  championshipSlug?: string | null;
  matchIndex?: number | null;
  caption?: string | null;
  taggedPlayerSlugs?: string[];
  sortOrder?: number;
}

export interface SeedData {
  generatedAt?: string;
  source?: string;
  team?: string;
  championships: SeedChampionship[];
  players: SeedPlayer[];
  matches: SeedMatch[];
  attendances: SeedAttendance[];
  goals: SeedGoal[];
  photos?: SeedPhoto[];
}

export interface PlayerStats {
  playerSlug: string;
  playerName: string;
  played: number;
  eligible: number;
  attendancePct: number;
  justifiedPct: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  goals: number;
  longestStreak: number;
}

export interface TeamRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}
