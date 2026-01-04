
export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  label: string;
  confidence?: number;
}

export interface FrameAnalysis {
  timestamp: number;
  summary: string;
  tacticalAdvice: string;
  mistakes: string[]; // List of specific bad plays/errors
  healthEstimate: number; // 0-100
  buildMode: boolean;
  youtubeSearchQueries: string[];
  objects: BoundingBox[];
}

export interface ClipStats {
  kills: number;
  damageDealt: number;
  placementPrediction: string;
  playStyle: 'Aggressive' | 'Passive' | 'Tactical' | 'Builder';
}

export interface TimelineEvent {
  timestamp: number;
  type: string; // Changed from literal union to string to allow custom types
  label: string;
  confidence: number;
}

export enum AnalysisStatus {
  IDLE,
  PROCESSING,
  COMPLETE,
  ERROR
}
