import { 
  CoachingEngine, 
  CoachingSuggestion, 
  EnhancedRealtimeMetrics, 
  CoachingAnalytics,
  ScenarioType,
  SuggestionType,
  Language
} from '../types';
import { COACHING_THRESHOLDS, SUGGESTION_MESSAGES } from '../constants';
import { SuggestionQueue } from './suggestionQueue';

export class CoachingEngineService implements CoachingEngine {
  private static instance: CoachingEngineService;
  private currentScenario: ScenarioType = ScenarioType.NORMAL;
  private suggestionsEnabled: boolean = true;
  private lastSuggestionTime: number = 0;
  private analytics: CoachingAnalytics;
  private language: Language = 'en';
  private suggestionQueue: SuggestionQueue;
  
  // Error handling and circuit breaker
  private errorCount: number = 0;
  private maxErrors: number = 5;
  private circuitBreakerOpen: boolean = false;
  private lastErrorTime: number = 0;
  private circuitBreakerResetTime: number = 60000; // 1 minute

  private constructor() {
    this.analytics = this.initializeAnalytics();
    this.suggestionQueue = SuggestionQueue.getInstance();
  }

  public static getInstance(): CoachingEngineService {
    if (!CoachingEngineService.instance) {
      CoachingEngineService.instance = new CoachingEngineService();
    }
    return CoachingEngineService.instance;
  }

  private initializeAnalytics(): CoachingAnalytics {
    return {
      sessionId: `session-${Date.now()}`,
      suggestionsShown: [],
      suggestionsActedUpon: [],
      averageResponseTime: 0,
      improvementMetrics: {
        energyTrend: [],
        paceTrend: [],
        pauseQuality: []
      }
    };
  }

  public setLanguage(lang: Language): void {
    this.language = lang;
  }

  public setScenarioContext(scenario: ScenarioType): void {
    this.currentScenario = scenario;
  }

  public setSuggestionsEnabled(enabled: boolean): void {
    this.suggestionsEnabled = enabled;
    if (!enabled) {
      this.suggestionQueue.clearQueue();
    }
  }

  public analyzeSpeechPattern(metrics: EnhancedRealtimeMetrics): CoachingSuggestion | null {
    if (!this.suggestionsEnabled) {
      // Still collect analytics even when suggestions are disabled
      this.updateAnalytics(metrics);
      return null;
    }

    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      const now = Date.now();
      if (now - this.lastErrorTime > this.circuitBreakerResetTime) {
        this.resetCircuitBreaker();
      } else {
        // Circuit breaker is open, skip analysis but continue collecting data
        this.updateAnalytics(metrics);
        return null;
      }
    }

    try {
      // Check if we're still in cooldown period
      const now = Date.now();
      if (now - this.lastSuggestionTime < COACHING_THRESHOLDS.SUGGESTION_COOLDOWN) {
        return null;
      }

      const suggestion = this.generateSuggestion(metrics);
      if (suggestion) {
        this.lastSuggestionTime = now;
        this.analytics.suggestionsShown.push(suggestion);
        this.suggestionQueue.addSuggestion(suggestion);
      }

      this.updateAnalytics(metrics);
      return suggestion;
    } catch (error) {
      this.handleError(error);
      // Graceful degradation: still update analytics
      this.updateAnalytics(metrics);
      return null;
    }
  }

  private generateSuggestion(metrics: EnhancedRealtimeMetrics): CoachingSuggestion | null {
    // Priority order: energy -> pace -> pause -> clarity -> filler
    
    // Check for low energy
    if (metrics.energy < COACHING_THRESHOLDS.LOW_ENERGY) {
      return this.createSuggestion('energy', metrics);
    }

    // Check for speaking too fast
    if (metrics.pace > COACHING_THRESHOLDS.HIGH_PACE) {
      return this.createSuggestion('pace', metrics);
    }

    // Check for long pauses
    if (metrics.silenceDuration > COACHING_THRESHOLDS.LONG_PAUSE) {
      return this.createSuggestion('pause', metrics);
    }

    // Check for clarity issues
    if (metrics.speechClarity < 0.7) {
      return this.createSuggestion('clarity', metrics);
    }

    // Check for filler words
    if (metrics.fillerWordCount > 3) {
      return this.createSuggestion('filler', metrics);
    }

    return null;
  }

  private createSuggestion(type: SuggestionType, metrics: EnhancedRealtimeMetrics): CoachingSuggestion {
    const baseMessage = SUGGESTION_MESSAGES[type][this.language];
    const scenarioSpecificMessage = this.getScenarioSpecificMessage(type, metrics);
    
    return {
      id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message: scenarioSpecificMessage || baseMessage,
      detailedTip: this.getDetailedTip(type, metrics),
      priority: this.getPriority(type, metrics),
      timestamp: Date.now()
    };
  }

  private getScenarioSpecificMessage(type: SuggestionType, metrics: EnhancedRealtimeMetrics): string | null {
    // Customize suggestions based on scenario type
    switch (this.currentScenario) {
      case ScenarioType.DEBATE:
        if (type === 'energy' && this.language === 'en') {
          return 'Project confidence and authority in your voice';
        }
        if (type === 'pace' && this.language === 'en') {
          return 'Slow down to make your arguments more persuasive';
        }
        break;
      
      case ScenarioType.SALES:
        if (type === 'energy' && this.language === 'en') {
          return 'Show enthusiasm for your product';
        }
        if (type === 'pause' && this.language === 'en') {
          return 'Use strategic pauses to let key points sink in';
        }
        break;
      
      case ScenarioType.CONFIDENCE:
        if (type === 'energy' && this.language === 'en') {
          return 'Speak with warmth and openness';
        }
        if (type === 'pace' && this.language === 'en') {
          return 'Take your time - there\'s no rush to share';
        }
        break;
    }
    
    return null;
  }

  private getDetailedTip(type: SuggestionType, metrics: EnhancedRealtimeMetrics): string {
    const tips = {
      energy: {
        en: 'Try standing up, smiling, or using hand gestures to naturally increase your vocal energy.',
        ar_msa: 'حاول الوقوف أو الابتسام أو استخدام إيماءات اليد لزيادة طاقة صوتك بشكل طبيعي.',
        ar_khaleeji: 'حاول تقوم أو تبتسم أو تستخدم إيماءات يدك عشان تزيد طاقة صوتك.'
      },
      pace: {
        en: 'Focus on articulating each word clearly. Pause between key points.',
        ar_msa: 'ركز على نطق كل كلمة بوضوح. توقف بين النقاط المهمة.',
        ar_khaleeji: 'ركز على نطق كل كلمة واضح. وقف بين النقاط المهمة.'
      },
      pause: {
        en: 'It\'s okay to take a moment to think. Silence can be powerful.',
        ar_msa: 'لا بأس في أخذ لحظة للتفكير. الصمت يمكن أن يكون قوياً.',
        ar_khaleeji: 'عادي تاخذ وقت تفكر. السكوت أحياناً يكون قوي.'
      },
      clarity: {
        en: 'Open your mouth wider and speak from your diaphragm.',
        ar_msa: 'افتح فمك أكثر وتحدث من الحجاب الحاجز.',
        ar_khaleeji: 'افتح فمك أكثر وسولف من صدرك.'
      },
      filler: {
        en: 'Replace "um" and "uh" with brief pauses. It sounds more confident.',
        ar_msa: 'استبدل "أم" و "آه" بتوقفات قصيرة. يبدو أكثر ثقة.',
        ar_khaleeji: 'بدال ما تقول "أم" و "آه" اسكت شوي. يطلع أوثق.'
      }
    };

    return tips[type][this.language];
  }

  private getPriority(type: SuggestionType, metrics: EnhancedRealtimeMetrics): 'low' | 'medium' | 'high' {
    switch (type) {
      case 'energy':
        return metrics.energy < 0.1 ? 'high' : 'medium';
      case 'pace':
        return metrics.pace > 12 ? 'high' : 'medium';
      case 'pause':
        return metrics.silenceDuration > 5000 ? 'high' : 'low';
      case 'clarity':
        return metrics.speechClarity < 0.5 ? 'high' : 'medium';
      case 'filler':
        return metrics.fillerWordCount > 5 ? 'medium' : 'low';
      default:
        return 'low';
    }
  }

  private updateAnalytics(metrics: EnhancedRealtimeMetrics): void {
    this.analytics.improvementMetrics.energyTrend.push(metrics.energy);
    this.analytics.improvementMetrics.paceTrend.push(metrics.pace);
    this.analytics.improvementMetrics.pauseQuality.push(
      metrics.silenceDuration > COACHING_THRESHOLDS.LONG_PAUSE ? 0 : 1
    );

    // Keep only last 50 data points to prevent memory bloat
    const maxDataPoints = 50;
    if (this.analytics.improvementMetrics.energyTrend.length > maxDataPoints) {
      this.analytics.improvementMetrics.energyTrend.shift();
      this.analytics.improvementMetrics.paceTrend.shift();
      this.analytics.improvementMetrics.pauseQuality.shift();
    }
  }

  public getAnalytics(): CoachingAnalytics {
    return { ...this.analytics };
  }

  public markSuggestionActedUpon(suggestionId: string): void {
    if (!this.analytics.suggestionsActedUpon.includes(suggestionId)) {
      this.analytics.suggestionsActedUpon.push(suggestionId);
    }
  }

  public getCurrentSuggestion(): CoachingSuggestion | null {
    return this.suggestionQueue.getCurrentSuggestion();
  }

  public dismissCurrentSuggestion(): void {
    this.suggestionQueue.dismissCurrent();
  }

  public getSuggestionQueue(): SuggestionQueue {
    return this.suggestionQueue;
  }

  public resetSession(): void {
    this.analytics = this.initializeAnalytics();
    this.lastSuggestionTime = 0;
    this.suggestionQueue.clearQueue();
    this.resetCircuitBreaker();
  }

  private handleError(error: any): void {
    console.warn('CoachingEngine error:', error);
    this.errorCount++;
    this.lastErrorTime = Date.now();
    
    if (this.errorCount >= this.maxErrors) {
      this.circuitBreakerOpen = true;
      console.warn('CoachingEngine circuit breaker opened due to repeated errors');
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.errorCount = 0;
    console.log('CoachingEngine circuit breaker reset');
  }

  public getHealthStatus(): { healthy: boolean; errorCount: number; circuitBreakerOpen: boolean } {
    return {
      healthy: !this.circuitBreakerOpen && this.errorCount < this.maxErrors,
      errorCount: this.errorCount,
      circuitBreakerOpen: this.circuitBreakerOpen
    };
  }

  // Utility method to detect filler words (basic implementation)
  public static detectFillerWords(text: string, language: Language): number {
    const fillerPatterns = {
      en: /\b(um|uh|er|ah|like|you know|actually|basically)\b/gi,
      ar_msa: /\b(أم|آه|يعني|أساساً|فعلياً)\b/gi,
      ar_khaleeji: /\b(أم|آه|يعني|بس|شوف)\b/gi
    };

    const pattern = fillerPatterns[language];
    const matches = text.match(pattern);
    return matches ? matches.length : 0;
  }
}