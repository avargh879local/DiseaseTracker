export type Source = 'CDC' | 'WHO' | 'ProMED' | 'ReliefWeb';
export type Severity = 'high' | 'medium' | 'low';

export interface Signal {
  id: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: Source;
  severity: Severity;
  region: string;
  disease: string;
  location: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  caseCount?: number;
  deathCount?: number;
}

export interface SignalsResponse {
  signals: Signal[];
  lastUpdated: string;
  sourceStatus: Record<Source, 'ok' | 'error'>;
}
