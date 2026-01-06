import React, { useState, useRef } from 'react';
import { Language, PronunciationItem } from '../types';
import { CommunicationCoach } from '../services/geminiService';
import { TRANSLATIONS } from '../constants';
import { decode, decodeAudioData } from '../services/audioUtils';

interface Props {
  items: PronunciationItem[];
  lang: Language;
  coach: CommunicationCoach;
  onClose: () => void;
}

const PronunciationWorkshop: React.FC<Props> = ({ items, lang, coach, onClose }) => {
  const [selectedWord, setSelectedWord] = useState<PronunciationItem | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [attemptResult, setAttemptResult] = useState<any>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const t = (key: keyof typeof TRANSLATIONS) => TRANSLATIONS[key][lang];

  const playMaster = async (text: string) => {
    try {
      setIsPlaying(true);
      const base64 = await coach.generateSpeech(text, lang);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const buffer = await decodeAudioData(decode(base64), audioContextRef.current, 24000, 1);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
    } catch (err) {
      console.error(err);
      setIsPlaying(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        setIsProcessing(true);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          try {
            const result = await coach.analyzePronunciationAttempt(selectedWord!.word, base64, lang);
            setAttemptResult(result);
          } catch (e) {
            console.error(e);
          } finally {
            setIsProcessing(false);
          }
        };
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setAttemptResult(null);
    } catch (err) {
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl animate-fadeIn flex flex-col p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-microphone-alt text-blue-500"></i>
          {/* Fix translation key error: changed 'pronunciationWorkshop' to 'pronunciationTitle' */}
          {t('pronunciationTitle')}
        </h2>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
          <i className="fas fa-times"></i>
        </button>
      </div>

      {!selectedWord ? (
        <div className="flex-1 space-y-6">
          <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl">
            <p className="text-xs text-blue-400 font-bold uppercase tracking-widest">Target Words</p>
            <p className="text-sm text-slate-400 mt-1">These words were flagged as needing improvement in your last session.</p>
          </div>
          <div className="grid gap-4">
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedWord(item)}
                className="group flex items-center p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500 transition-all text-left"
              >
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">{item.word}</h3>
                  <p className="text-xs text-blue-400 font-mono mb-2">{item.phonetic}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-600 group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-all">
                  <i className="fas fa-chevron-right"></i>
                </div>
              </button>
            ))}
            {items.length === 0 && (
              <div className="py-20 text-center text-slate-600">
                 <i className="fas fa-check-circle text-4xl mb-4"></i>
                 <p>All words pronounced perfectly!</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center space-y-10 animate-scaleIn">
          <button 
            onClick={() => { setSelectedWord(null); setAttemptResult(null); }}
            className="self-start text-slate-500 hover:text-white mb-4 text-sm flex items-center gap-2"
          >
            <i className={`fas fa-arrow-${lang.startsWith('ar') ? 'right' : 'left'}`}></i>
            Back to list
          </button>

          <div className="text-center space-y-4">
            <h1 className="text-4xl font-black text-white tracking-tight">{selectedWord.word}</h1>
            <p className="text-blue-400 font-mono">{selectedWord.phonetic}</p>
          </div>

          <div className="flex gap-6">
            <button
              onClick={() => playMaster(selectedWord.word)}
              disabled={isPlaying}
              className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all ${
                isPlaying ? 'bg-blue-600 animate-pulse' : 'bg-slate-900 border border-slate-800 hover:border-blue-500'
              }`}
            >
              <i className="fas fa-volume-up text-xl mb-1"></i>
              <span className="text-[10px] font-bold uppercase">{t('listen')}</span>
            </button>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all shadow-xl ${
                isRecording 
                  ? 'bg-red-500 scale-110 shadow-red-500/20' 
                  : 'bg-slate-100 text-slate-950 hover:bg-white'
              }`}
            >
              <i className={`fas ${isRecording ? 'fa-square' : 'fa-microphone'} text-xl mb-1`}></i>
              <span className="text-[10px] font-bold uppercase">{isRecording ? t('stop') : t('record')}</span>
            </button>
          </div>

          {isProcessing && (
             <div className="flex items-center gap-3 text-blue-500 animate-pulse">
                <i className="fas fa-circle-notch fa-spin"></i>
                <span className="text-sm font-bold tracking-widest uppercase">Analyzing...</span>
             </div>
          )}

          {attemptResult && !isProcessing && (
            <div className="w-full p-6 rounded-3xl bg-slate-900 border border-slate-800 animate-fadeIn text-center space-y-4">
              <div className={`text-2xl font-black ${attemptResult.score > 80 ? 'text-green-400' : 'text-amber-400'}`}>
                {attemptResult.score}%
              </div>
              <p className="text-slate-300 italic">"{attemptResult.feedback}"</p>
            </div>
          )}

          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 w-full">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Coach's Tip</h4>
            <p className="text-sm text-slate-400 leading-relaxed">{selectedWord.tips[lang] || selectedWord.tips['en']}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PronunciationWorkshop;