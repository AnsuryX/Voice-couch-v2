
import React, { useEffect, useRef } from 'react';
import { Language, EnhancedRealtimeMetrics, ConversationFlow } from '../types';
import { CoachingEngineService } from '../services/coachingEngine';

interface Props {
  energy: number; // 0 to 1
  pace: number;   // calculated words or beats per second roughly
  lang: Language;
  onCoachingAnalysis?: (metrics: EnhancedRealtimeMetrics) => void;
}

const LiveMetrics: React.FC<Props> = ({ energy, pace, lang, onCoachingAnalysis }) => {
  const isRTL = lang.startsWith('ar');
  const coachingEngine = useRef(CoachingEngineService.getInstance());
  const lastSpeechTime = useRef(Date.now());
  const silenceStartTime = useRef<number | null>(null);
  const fillerWordCount = useRef(0);
  const speechClarityBuffer = useRef<number[]>([]);

  // Calculate enhanced metrics
  useEffect(() => {
    const now = Date.now();
    
    // Calculate silence duration
    let silenceDuration = 0;
    if (energy < 0.05) { // Very low energy indicates silence
      if (silenceStartTime.current === null) {
        silenceStartTime.current = now;
      }
      silenceDuration = now - silenceStartTime.current;
    } else {
      silenceStartTime.current = null;
      lastSpeechTime.current = now;
    }

    // Calculate speech clarity (simplified - based on energy consistency)
    speechClarityBuffer.current.push(energy);
    if (speechClarityBuffer.current.length > 10) {
      speechClarityBuffer.current.shift();
    }
    
    const energyVariance = calculateVariance(speechClarityBuffer.current);
    const speechClarity = Math.max(0, 1 - energyVariance * 2); // Lower variance = higher clarity

    // Determine conversation flow
    let conversationFlow: ConversationFlow = 'smooth';
    if (pace > 12) {
      conversationFlow = 'rushed';
    } else if (silenceDuration > 2000 || energy < 0.1) {
      conversationFlow = 'hesitant';
    }

    // Create enhanced metrics
    const enhancedMetrics: EnhancedRealtimeMetrics = {
      energy,
      pace,
      silenceDuration,
      fillerWordCount: fillerWordCount.current,
      speechClarity,
      conversationFlow
    };

    // Trigger coaching analysis
    if (onCoachingAnalysis) {
      onCoachingAnalysis(enhancedMetrics);
    }

    // Update coaching engine language
    coachingEngine.current.setLanguage(lang);
    
    // Analyze for coaching suggestions
    coachingEngine.current.analyzeSpeechPattern(enhancedMetrics);

  }, [energy, pace, lang, onCoachingAnalysis]);

  const calculateVariance = (values: number[]): number => {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  };
  
  // Tone color mapping
  const toneColor = energy > 0.8 ? 'bg-red-500' : energy > 0.4 ? 'bg-amber-400' : energy > 0.05 ? 'bg-blue-400' : 'bg-slate-700';
  const toneLabel = energy > 0.8 ? (isRTL ? 'مرتفع جداً' : 'Aggressive') : energy > 0.4 ? (isRTL ? 'نشط' : 'Energetic') : energy > 0.05 ? (isRTL ? 'هادئ' : 'Calm') : (isRTL ? 'صامت' : 'Silent');

  // Pace mapping
  const paceLabel = pace > 15 ? (isRTL ? 'سريع جداً' : 'Fast') : pace > 5 ? (isRTL ? 'مثالي' : 'Steady') : (isRTL ? 'بطيء' : 'Slow');
  const paceColor = pace > 15 ? 'text-red-400' : pace > 5 ? 'text-green-400' : 'text-slate-500';

  return (
    <div className="w-full flex flex-col gap-4 mt-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isRTL ? 'النبرة' : 'Tone'}</span>
          <span className={`text-xs font-bold transition-colors duration-300 ${toneLabel !== 'Silent' && toneLabel !== 'صامت' ? 'text-white' : 'text-slate-600'}`}>
            {toneLabel}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isRTL ? 'السرعة' : 'Pace'}</span>
          <span className={`text-xs font-bold transition-colors duration-300 ${paceColor}`}>
            {paceLabel}
          </span>
        </div>
      </div>
      
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
        <div 
          className={`h-full transition-all duration-300 ${toneColor}`} 
          style={{ width: `${Math.min(energy * 100, 100)}%` }} 
        />
      </div>
    </div>
  );
};

export default LiveMetrics;
