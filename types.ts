
export type Language = 'en' | 'ar_msa' | 'ar_khaleeji';

export type PaceSpeed = 'slow' | 'normal' | 'fast';

export type SuggestionType = 'energy' | 'pace' | 'pause' | 'clarity' | 'filler';

export type ConversationFlow = 'smooth' | 'hesitant' | 'rushed';

export enum ScenarioType {
  SALES = 'SALES',
  NORMAL = 'NORMAL',
  DEBATE = 'DEBATE',
  CONFIDENCE = 'CONFIDENCE'
}

export interface Persona {
  id: string;
  name: Record<Language, string>;
  role: Record<Language, string>;
  personality: Record<Language, string>;
  icon: string;
  isWarm?: boolean; 
}

export interface Scenario {
  id: string;
  type: ScenarioType;
  title: Record<Language, string>;
  description: Record<Language, string>;
  icon: string;
  personas: Persona[];
}

export interface SessionConfig {
  scenario: Scenario;
  persona: Persona;
  topic: string;
  outcome: string;
  focusSkills: string[];
}

export interface PronunciationItem {
  word: string;
  phonetic?: string;
  tips: Record<Language, string>;
}

export interface RecordingTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  audioUrl?: string;
}

export interface SessionResult {
  id: string;
  date: string;
  scenarioType: ScenarioType;
  confidenceScore: number;
  effectivenessScore: number;
  feedback: string;
  duration: number;
  personaName: string;
  troubleWords?: PronunciationItem[];
  recordingTurns?: RecordingTurn[];
}

export interface UserProfile {
  name: string;
  bio: string;
  goal: string;
  preferredTone: 'brutal' | 'supportive';
  joinedDate: string;
}

export interface UserStats {
  totalSessions: number;
  avgConfidence: number;
  bestScenario: ScenarioType;
}

// Pace Control Interfaces
export interface PaceSettings {
  currentPace: PaceSpeed;
  paceMultiplier: number;
  persistAcrossSessions: boolean;
}

// Coaching System Interfaces
export interface CoachingSuggestion {
  id: string;
  type: SuggestionType;
  message: string;
  detailedTip?: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface RealtimeMetrics {
  energy: number;
  pace: number;
}

export interface EnhancedRealtimeMetrics extends RealtimeMetrics {
  silenceDuration: number;
  fillerWordCount: number;
  speechClarity: number;
  conversationFlow: ConversationFlow;
}

export interface CoachingAnalytics {
  sessionId: string;
  suggestionsShown: CoachingSuggestion[];
  suggestionsActedUpon: string[];
  averageResponseTime: number;
  improvementMetrics: {
    energyTrend: number[];
    paceTrend: number[];
    pauseQuality: number[];
  };
}

// Component Props Interfaces
export interface PaceControllerProps {
  currentPace: PaceSpeed;
  onPaceChange: (pace: PaceSpeed) => void;
  disabled?: boolean;
}

export interface SuggestionDisplayProps {
  suggestion: CoachingSuggestion | null;
  onDismiss: () => void;
  onExpand: (suggestion: CoachingSuggestion) => void;
}

// Service Interfaces
export interface CoachingEngine {
  analyzeSpeechPattern(metrics: EnhancedRealtimeMetrics): CoachingSuggestion | null;
  setScenarioContext(scenario: ScenarioType): void;
  setSuggestionsEnabled(enabled: boolean): void;
  getAnalytics(): CoachingAnalytics;
}

export interface AudioPaceProcessor {
  applyPaceAdjustment(audioBuffer: AudioBuffer, pace: number): AudioBuffer;
  createPacedSource(audioData: ArrayBuffer, pace: number): AudioBufferSourceNode;
}
