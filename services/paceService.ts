import { PaceSpeed, PaceSettings } from '../types';
import { PACE_MULTIPLIERS } from '../constants';

const PACE_STORAGE_KEY = 'vocaledge_pace_settings';

export class PaceService {
  private static instance: PaceService;
  private currentSettings: PaceSettings;

  private constructor() {
    this.currentSettings = this.loadSettings();
  }

  public static getInstance(): PaceService {
    if (!PaceService.instance) {
      PaceService.instance = new PaceService();
    }
    return PaceService.instance;
  }

  private loadSettings(): PaceSettings {
    try {
      const stored = localStorage.getItem(PACE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate the stored data
        if (this.isValidPaceSettings(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load pace settings from localStorage:', error);
    }

    // Return default settings if loading fails
    return {
      currentPace: 'normal',
      paceMultiplier: PACE_MULTIPLIERS.normal,
      persistAcrossSessions: true
    };
  }

  private isValidPaceSettings(settings: any): settings is PaceSettings {
    return (
      settings &&
      typeof settings === 'object' &&
      ['slow', 'normal', 'fast'].includes(settings.currentPace) &&
      typeof settings.paceMultiplier === 'number' &&
      typeof settings.persistAcrossSessions === 'boolean'
    );
  }

  private saveSettings(): void {
    if (!this.currentSettings.persistAcrossSessions) {
      return; // Don't persist if user doesn't want persistence
    }

    try {
      localStorage.setItem(PACE_STORAGE_KEY, JSON.stringify(this.currentSettings));
    } catch (error) {
      console.warn('Failed to save pace settings to localStorage:', error);
      // Continue without persistence - graceful degradation
    }
  }

  public getCurrentPace(): PaceSpeed {
    return this.currentSettings.currentPace;
  }

  public getPaceMultiplier(): number {
    return this.currentSettings.paceMultiplier;
  }

  public setPace(pace: PaceSpeed): void {
    this.currentSettings.currentPace = pace;
    this.currentSettings.paceMultiplier = PACE_MULTIPLIERS[pace];
    this.saveSettings();
  }

  public setPersistence(persist: boolean): void {
    this.currentSettings.persistAcrossSessions = persist;
    if (persist) {
      this.saveSettings();
    } else {
      // Remove from localStorage if persistence is disabled
      try {
        localStorage.removeItem(PACE_STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to remove pace settings from localStorage:', error);
      }
    }
  }

  public getSettings(): PaceSettings {
    return { ...this.currentSettings };
  }

  public resetToDefault(): void {
    this.currentSettings = {
      currentPace: 'normal',
      paceMultiplier: PACE_MULTIPLIERS.normal,
      persistAcrossSessions: true
    };
    this.saveSettings();
  }
}