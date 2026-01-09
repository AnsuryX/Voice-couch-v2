import React, { useEffect, useState } from 'react';
import { CoachingSuggestion, Language, SuggestionDisplayProps } from '../types';
import { COACHING_THRESHOLDS } from '../constants';

interface Props extends SuggestionDisplayProps {
  lang: Language;
}

const SuggestionDisplay: React.FC<Props> = ({ 
  suggestion, 
  onDismiss, 
  onExpand, 
  lang 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (suggestion) {
      setIsVisible(true);
      setIsExpanded(false);
      
      // Auto-dismiss after 4 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, COACHING_THRESHOLDS.AUTO_DISMISS_TIME);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      setIsExpanded(false);
    }
  }, [suggestion]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss();
    }, 300); // Wait for fade out animation
  };

  const handleExpand = () => {
    if (suggestion) {
      setIsExpanded(true);
      onExpand(suggestion);
    }
  };

  if (!suggestion) return null;

  const getPriorityColor = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high': return 'border-red-500/30 bg-red-500/10';
      case 'medium': return 'border-yellow-500/30 bg-yellow-500/10';
      case 'low': return 'border-blue-500/30 bg-blue-500/10';
      default: return 'border-blue-500/30 bg-blue-500/10';
    }
  };

  const getPriorityIcon = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high': return 'fa-exclamation-triangle text-red-400';
      case 'medium': return 'fa-info-circle text-yellow-400';
      case 'low': return 'fa-lightbulb text-blue-400';
      default: return 'fa-lightbulb text-blue-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'energy': return 'fa-bolt';
      case 'pace': return 'fa-tachometer-alt';
      case 'pause': return 'fa-pause';
      case 'clarity': return 'fa-volume-up';
      case 'filler': return 'fa-filter';
      default: return 'fa-comment';
    }
  };

  return (
    <div 
      className={`
        fixed top-20 left-4 right-4 z-50 transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}
        ${lang.startsWith('ar') ? 'font-arabic' : 'font-english'}
      `}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div 
        className={`
          relative rounded-2xl border backdrop-blur-xl shadow-2xl overflow-hidden
          ${getPriorityColor(suggestion.priority)}
          ${isExpanded ? 'max-h-96' : 'max-h-24'}
          transition-all duration-300 ease-out
        `}
      >
        {/* Main suggestion content */}
        <div 
          className="p-4 cursor-pointer"
          onClick={handleExpand}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleExpand();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`${suggestion.message}. ${lang === 'en' ? 'Press Enter to expand' : lang === 'ar_msa' ? 'اضغط Enter للتوسيع' : 'اضغط Enter للتوسيع'}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center">
              <i className={`fas ${getTypeIcon(suggestion.type)} text-sm text-slate-300`}></i>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <i className={`fas ${getPriorityIcon(suggestion.priority)} text-xs`}></i>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {lang === 'en' ? 'Coaching Tip' : lang === 'ar_msa' ? 'نصيحة تدريبية' : 'نصيحة'}
                </span>
              </div>
              
              <p className="text-sm font-medium text-white leading-relaxed">
                {suggestion.message}
              </p>
              
              {!isExpanded && (
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'en' ? 'Tap to expand' : lang === 'ar_msa' ? 'اضغط للتوسيع' : 'اضغط للتوسيع'}
                </p>
              )}
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDismiss();
                }
              }}
              aria-label={lang === 'en' ? 'Dismiss suggestion' : lang === 'ar_msa' ? 'إغلاق النصيحة' : 'إغلاق النصيحة'}
              className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700/50 focus:text-white focus:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && suggestion.detailedTip && (
          <div className="px-4 pb-4 border-t border-white/10">
            <div className="pt-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                {lang === 'en' ? 'Detailed Guidance' : lang === 'ar_msa' ? 'إرشادات مفصلة' : 'تفاصيل أكثر'}
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed">
                {suggestion.detailedTip}
              </p>
            </div>
          </div>
        )}

        {/* Progress bar for auto-dismiss */}
        {!isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-[4000ms] ease-linear"
              style={{
                width: isVisible ? '0%' : '100%'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SuggestionDisplay;