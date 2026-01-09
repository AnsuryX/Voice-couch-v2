import { CoachingSuggestion } from '../types';

export class SuggestionQueue {
  private static instance: SuggestionQueue;
  private queue: CoachingSuggestion[] = [];
  private currentSuggestion: CoachingSuggestion | null = null;
  private isDisplaying: boolean = false;
  private displayCallbacks: {
    onShow?: (suggestion: CoachingSuggestion) => void;
    onHide?: () => void;
  } = {};

  private constructor() {}

  public static getInstance(): SuggestionQueue {
    if (!SuggestionQueue.instance) {
      SuggestionQueue.instance = new SuggestionQueue();
    }
    return SuggestionQueue.instance;
  }

  public setDisplayCallbacks(callbacks: {
    onShow?: (suggestion: CoachingSuggestion) => void;
    onHide?: () => void;
  }): void {
    this.displayCallbacks = callbacks;
  }

  public addSuggestion(suggestion: CoachingSuggestion): void {
    // Add to queue if not already displaying or if different from current
    if (!this.isDisplaying || this.currentSuggestion?.id !== suggestion.id) {
      // Check if suggestion is already in queue
      const existingIndex = this.queue.findIndex(s => s.id === suggestion.id);
      if (existingIndex === -1) {
        // Insert based on priority (high priority first)
        const insertIndex = this.findInsertIndex(suggestion);
        this.queue.splice(insertIndex, 0, suggestion);
      }
    }

    // If not currently displaying, start displaying
    if (!this.isDisplaying) {
      this.displayNext();
    }
  }

  private findInsertIndex(suggestion: CoachingSuggestion): number {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const suggestionPriority = priorityOrder[suggestion.priority];

    for (let i = 0; i < this.queue.length; i++) {
      const queuedPriority = priorityOrder[this.queue[i].priority];
      if (suggestionPriority < queuedPriority) {
        return i;
      }
    }
    return this.queue.length;
  }

  public dismissCurrent(): void {
    if (this.currentSuggestion) {
      this.currentSuggestion = null;
      this.isDisplaying = false;
      this.displayCallbacks.onHide?.();
      
      // Display next suggestion after a brief delay
      setTimeout(() => {
        this.displayNext();
      }, 500);
    }
  }

  private displayNext(): void {
    if (this.queue.length > 0 && !this.isDisplaying) {
      this.currentSuggestion = this.queue.shift()!;
      this.isDisplaying = true;
      this.displayCallbacks.onShow?.(this.currentSuggestion);
    }
  }

  public getCurrentSuggestion(): CoachingSuggestion | null {
    return this.currentSuggestion;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public clearQueue(): void {
    this.queue = [];
    if (this.isDisplaying) {
      this.dismissCurrent();
    }
  }

  public isCurrentlyDisplaying(): boolean {
    return this.isDisplaying;
  }

  // Remove suggestions older than a certain time to prevent stale suggestions
  public cleanupOldSuggestions(maxAge: number = 30000): void {
    const now = Date.now();
    this.queue = this.queue.filter(suggestion => 
      now - suggestion.timestamp < maxAge
    );
  }
}