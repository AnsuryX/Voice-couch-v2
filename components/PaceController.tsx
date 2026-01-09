import React from 'react';
import { PaceSpeed, Language, PaceControllerProps } from '../types';
import { PACE_LABELS, TRANSLATIONS } from '../constants';

interface Props extends PaceControllerProps {
  lang: Language;
}

const PaceController: React.FC<Props> = ({ 
  currentPace, 
  onPaceChange, 
  disabled = false, 
  lang 
}) => {
  const paceOptions: PaceSpeed[] = ['slow', 'normal', 'fast'];

  const handlePaceSelect = (pace: PaceSpeed) => {
    if (!disabled) {
      onPaceChange(pace);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, pace: PaceSpeed) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePaceSelect(pace);
    }
  };

  const t = (key: keyof typeof TRANSLATIONS) => TRANSLATIONS[key][lang];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
        {t('paceControl')}
      </span>
      <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
        {paceOptions.map((pace) => (
          <button
            key={pace}
            onClick={() => handlePaceSelect(pace)}
            onKeyDown={(e) => handleKeyDown(e, pace)}
            disabled={disabled}
            aria-label={`${t('paceControl')}: ${PACE_LABELS[pace][lang]}`}
            aria-pressed={currentPace === pace}
            tabIndex={disabled ? -1 : 0}
            className={`
              px-3 py-1.5 text-xs font-bold rounded-lg transition-all
              ${currentPace === pace 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800 focus:text-white focus:bg-slate-800'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900'}
            `}
          >
            {PACE_LABELS[pace][lang]}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PaceController;