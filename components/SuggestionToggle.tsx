import React from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface Props {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  lang: Language;
  disabled?: boolean;
}

const SuggestionToggle: React.FC<Props> = ({ 
  enabled, 
  onToggle, 
  lang, 
  disabled = false 
}) => {
  const t = (key: keyof typeof TRANSLATIONS) => TRANSLATIONS[key][lang];

  const getLabel = () => {
    const baseLabel = t('coachingSuggestions');
    const status = enabled 
      ? (lang === 'en' ? 'ON' : lang === 'ar_msa' ? 'مفعلة' : 'شغالة')
      : (lang === 'en' ? 'OFF' : lang === 'ar_msa' ? 'معطلة' : 'مطفية');
    return `${baseLabel}: ${status}`;
  };

  return (
    <button
      onClick={() => !disabled && onToggle(!enabled)}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all
        ${enabled 
          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
          : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
        }
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:scale-105 active:scale-95 cursor-pointer'
        }
      `}
    >
      <div className={`
        w-4 h-4 rounded-full flex items-center justify-center text-[10px]
        ${enabled ? 'bg-blue-500 text-white' : 'bg-slate-600 text-slate-400'}
      `}>
        <i className={`fas ${enabled ? 'fa-check' : 'fa-times'}`}></i>
      </div>
      <span className="uppercase tracking-widest">
        {getLabel()}
      </span>
    </button>
  );
};

export default SuggestionToggle;