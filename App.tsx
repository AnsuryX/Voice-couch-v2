import React, { useState, useEffect, useRef } from 'react';
import { Language, ScenarioType, SessionResult, Scenario, Persona, SessionConfig, RecordingTurn, UserProfile, PronunciationItem, PaceSpeed, CoachingSuggestion, EnhancedRealtimeMetrics } from './types.ts';
import { SCENARIOS, TRANSLATIONS, FOCUS_SKILLS } from './constants.ts';
import { CommunicationCoach } from './services/geminiService.ts';
import { CoachingEngineService } from './services/coachingEngine.ts';
import { SuggestionQueue } from './services/suggestionQueue.ts';
import { PaceService } from './services/paceService.ts';
import LanguageSwitcher from './components/LanguageSwitcher.tsx';
import VoiceVisualizer from './components/VoiceVisualizer.tsx';
import PronunciationWorkshop from './components/PronunciationWorkshop.tsx';
import LiveMetrics from './components/LiveMetrics.tsx';
import PaceController from './components/PaceController.tsx';
import SuggestionDisplay from './components/SuggestionDisplay.tsx';
import SuggestionToggle from './components/SuggestionToggle.tsx';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const [isRTL, setIsRTL] = useState(false);
  const [activeScreen, setActiveScreen] = useState<'loading' | 'home' | 'customize' | 'practice' | 'results' | 'stats' | 'profile'>('loading');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // User State (simplified for local development)
  const [user, setUser] = useState<any>(null);

  // Customization State
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [topic, setTopic] = useState('');
  const [outcome, setOutcome] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [lastTroubleWords, setLastTroubleWords] = useState<PronunciationItem[]>([]);

  // User Profile
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    bio: '',
    goal: '',
    preferredTone: 'supportive',
    joinedDate: new Date().toLocaleDateString()
  });

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [history, setHistory] = useState<SessionResult[]>([]);
  const [lastTranscription, setLastTranscription] = useState('');
  const [showWorkshop, setShowWorkshop] = useState(false);
  
  // Real-time metrics
  const [liveEnergy, setLiveEnergy] = useState(0);
  const [livePace, setLivePace] = useState(0);
  
  // Pace control state
  const [currentPace, setCurrentPace] = useState<PaceSpeed>('normal');
  
  // Coaching state
  const [currentSuggestion, setCurrentSuggestion] = useState<CoachingSuggestion | null>(null);
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);
  
  const coachRef = useRef<CommunicationCoach>(new CommunicationCoach());
  const startTimeRef = useRef<number | null>(null);
  const coachingEngineRef = useRef<CoachingEngineService>(CoachingEngineService.getInstance());
  const paceServiceRef = useRef<PaceService>(PaceService.getInstance());
  const suggestionQueueRef = useRef<SuggestionQueue>(SuggestionQueue.getInstance());

  useEffect(() => {
    setIsRTL(lang.startsWith('ar'));
    document.documentElement.dir = lang.startsWith('ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = lang === 'en' ? 'en' : 'ar';
    
    // Update coaching engine language
    coachingEngineRef.current.setLanguage(lang);
  }, [lang]);

  // Initialize pace control and coaching
  useEffect(() => {
    // Load saved pace setting
    const savedPace = paceServiceRef.current.getCurrentPace();
    setCurrentPace(savedPace);
    
    // Set up suggestion queue callbacks
    suggestionQueueRef.current.setDisplayCallbacks({
      onShow: (suggestion) => setCurrentSuggestion(suggestion),
      onHide: () => setCurrentSuggestion(null)
    });
    
    // Initialize coaching engine settings
    coachingEngineRef.current.setSuggestionsEnabled(suggestionsEnabled);
  }, [suggestionsEnabled]);

  // Skip authentication for local development
  useEffect(() => {
    // Create a mock user for local development
    const mockUser = {
      id: 'local-user',
      email: 'local@vocaledge.app',
      user_metadata: { name: 'Local User' }
    };
    setUser(mockUser as any);
    setActiveScreen('home');
  }, []);

  // Fetch data from Supabase when user is logged in
  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  // Mock data fetching for local development
  const fetchUserData = async () => {
    if (!user) return;
    
    // Set mock profile data
    setProfile({
      name: 'Local User',
      bio: 'Communication enthusiast',
      goal: 'Improve public speaking skills',
      preferredTone: 'supportive',
      joinedDate: new Date().toLocaleDateString()
    });

    // Set empty history for fresh start
    setHistory([]);
  };



  const wipeHistory = async () => {
    if (!user) return;
    if (!confirm("Are you sure you want to wipe all session history? This cannot be undone.")) return;
    
    // For local development, just clear the local history
    setHistory([]);
    setErrorMsg("History cleared.");
    setTimeout(() => setErrorMsg(null), 2000);
  };

  const handleSignOut = async () => {
    // Reset app to initial state
    setHistory([]);
    setProfile({
      name: 'Local User',
      bio: 'Communication enthusiast',
      goal: 'Improve public speaking skills',
      preferredTone: 'supportive',
      joinedDate: new Date().toLocaleDateString()
    });
    setActiveScreen('home');
  };

  const handleStartSession = async () => {
    if (!selectedScenario || !selectedPersona) return;
    setErrorMsg(null);
    setLastTranscription('');
    
    const config: SessionConfig = {
      scenario: selectedScenario,
      persona: selectedPersona,
      topic: topic || selectedScenario.description[lang],
      outcome: outcome || "Growth",
      focusSkills: selectedSkills.length > 0 ? selectedSkills : ['clarity']
    };

    // Set up coaching engine for this session
    coachingEngineRef.current.setScenarioContext(selectedScenario.type);
    coachingEngineRef.current.resetSession();

    setActiveScreen('practice');
    setIsSessionActive(true);
    startTimeRef.current = Date.now();

    try {
      await coachRef.current.startSession(config, lang, {
        onTranscriptionUpdate: (text) => setLastTranscription(text),
        onClose: () => setIsSessionActive(false),
        onerror: (e: any) => { 
          setErrorMsg(e?.message || "Connection failed."); 
          setIsSessionActive(false); 
          setActiveScreen('customize');
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize session.");
      setActiveScreen('customize');
      setIsSessionActive(false);
    }
  };

  const handlePaceChange = (pace: PaceSpeed) => {
    setCurrentPace(pace);
    coachRef.current.setPace(pace);
  };

  const handleSuggestionsToggle = (enabled: boolean) => {
    setSuggestionsEnabled(enabled);
    coachingEngineRef.current.setSuggestionsEnabled(enabled);
    if (!enabled) {
      setCurrentSuggestion(null);
    }
  };

  const handleSuggestionDismiss = () => {
    suggestionQueueRef.current.dismissCurrent();
  };

  const handleSuggestionExpand = (suggestion: CoachingSuggestion) => {
    // Mark suggestion as acted upon for analytics
    coachingEngineRef.current.markSuggestionActedUpon(suggestion.id);
  };

  const handleCoachingAnalysis = (metrics: EnhancedRealtimeMetrics) => {
    // Update live metrics for display
    setLiveEnergy(metrics.energy);
    setLivePace(metrics.pace);
  };

  const handleEndSession = async () => {
    const duration = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    setIsSessionActive(false);
    setIsAnalyzing(true);
    
    const { history: text, recordedTurns } = coachRef.current.stopSession();
    try {
      if (!text.trim()) { setActiveScreen('home'); return; }
      const res = await coachRef.current.getDetailedAnalysis(text, { scenario: selectedScenario!, persona: selectedPersona!, topic, outcome, focusSkills: selectedSkills }, lang);
      
      setAnalysisResult({ ...res, duration, recordingTurns: recordedTurns }); 
      
      if (res.troubleWords && res.troubleWords.length > 0) {
        setLastTroubleWords(res.troubleWords);
      } else {
        setLastTroubleWords([]);
      }

      // Store session in local history (no database for local development)
      const newSession = {
        id: `local-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        scenarioType: selectedScenario!.type,
        confidenceScore: res.confidenceScore,
        effectivenessScore: res.effectivenessScore,
        feedback: res.feedback,
        duration: duration,
        personaName: selectedPersona!.name[lang],
        recordingTurns: recordedTurns
      };

      setHistory(prev => [newSession, ...prev]);
      
      setActiveScreen('results');
    } catch (e) {
      setErrorMsg("Analysis failed.");
      setActiveScreen('home');
    } finally {
      setIsAnalyzing(false);
      startTimeRef.current = null;
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    // For local development, just show success message
    setErrorMsg("Profile saved locally!");
    setTimeout(() => setErrorMsg(null), 2000);
  };

  const t = (key: keyof typeof TRANSLATIONS) => TRANSLATIONS[key][lang];

  const navItems = [
    { id: 'home', label: t('practiceNow'), icon: 'fa-bullseye' },
    { id: 'stats', label: t('stats'), icon: 'fa-chart-bar' },
    { id: 'profile', label: t('profile'), icon: 'fa-user-circle' }
  ];

  const handleStartCustomize = (s: Scenario) => {
    setSelectedScenario(s);
    setSelectedPersona(s.personas[0]);
    // If we have trouble words, auto-populate pronunciation skill
    if (lastTroubleWords.length > 0) {
      setSelectedSkills(['clarity', 'pronunciation']);
    } else {
      setSelectedSkills(['clarity']);
    }
    setActiveScreen('customize');
  };

  if (activeScreen === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-white">
        <div className="w-16 h-16 rounded-[2rem] bg-blue-600 flex items-center justify-center animate-pulse">
           <i className="fas fa-bullseye text-2xl"></i>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-slate-100 ${isRTL ? 'font-arabic' : 'font-english'}`}>
      {errorMsg && (
        <div className="fixed top-20 left-6 right-6 z-[60] p-4 bg-blue-600/90 backdrop-blur rounded-2xl shadow-2xl animate-slideDown flex items-center justify-between">
           <p className="text-xs font-bold text-white uppercase tracking-tight">{errorMsg}</p>
           <button onClick={() => setErrorMsg(null)} className="text-white/50"><i className="fas fa-times"></i></button>
        </div>
      )}

      <header className="px-6 py-4 flex justify-between items-center border-b border-slate-900 bg-slate-950/50 backdrop-blur-lg sticky top-0 z-50">
        <h1 className="text-xl font-black italic tracking-tighter">
          <span className="text-blue-500">VOCAL</span>EDGE
        </h1>
        <div className="flex items-center gap-3">
          <LanguageSwitcher current={lang} onChange={setLang} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4 pb-32">
        {activeScreen === 'home' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-black text-white">{t('welcome')}{profile.name ? `, ${profile.name}` : ''}</h2>
              <p className="text-slate-500 text-sm">Select a training scenario to begin.</p>
            </div>
            <div className="grid gap-4">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => handleStartCustomize(s)} className="group relative flex items-center p-5 rounded-[2rem] bg-slate-900 border border-slate-800 active:scale-[0.98] transition-all overflow-hidden text-left">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-blue-500 text-2xl group-hover:text-white group-hover:bg-blue-600 transition-all">
                    <i className={`fas ${s.icon}`}></i>
                  </div>
                  <div className={`flex-1 ${isRTL ? 'mr-4 text-right' : 'ml-4'}`}>
                    <h4 className="font-bold text-lg">{s.title[lang]}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{s.description[lang]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeScreen === 'profile' && (
          <div className="space-y-8 animate-fadeIn">
            <h2 className="text-3xl font-black">{t('profile')}</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('userName')}</label>
                <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('userGoal')}</label>
                <textarea value={profile.goal} onChange={e => setProfile({...profile, goal: e.target.value})} className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500 h-24" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('toneVibe')}</label>
                <select value={profile.preferredTone} onChange={e => setProfile({...profile, preferredTone: e.target.value as any})} className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500">
                  <option value="supportive">Supportive Coach</option>
                  <option value="brutal">Brutal Honesty</option>
                </select>
              </div>
              <button onClick={saveProfile} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95">SAVE LOCALLY</button>
              <div className="pt-6 space-y-4">
                <button onClick={wipeHistory} className="w-full p-5 rounded-2xl bg-red-900/10 border border-red-500/10 flex items-center justify-between group active:bg-red-900/20">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500"><i className="fas fa-fire"></i></div>
                    <span className="font-bold text-sm text-red-400">{t('settingsClearData')}</span>
                  </div>
                  <i className="fas fa-chevron-right text-red-900/50"></i>
                </button>
                <button onClick={handleSignOut} className="w-full p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-3 active:bg-slate-800 transition-all">
                  <i className="fas fa-home text-slate-500"></i>
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">Reset App</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeScreen === 'customize' && selectedScenario && (
          <div className="space-y-6 animate-fadeIn">
            <button onClick={() => setActiveScreen('home')} className="text-slate-500 flex items-center gap-2 font-bold text-sm uppercase tracking-widest">
              <i className={`fas fa-chevron-${isRTL ? 'right' : 'left'}`}></i> Back
            </button>
            <h2 className="text-3xl font-black">{t('customize')}</h2>
            <div className="space-y-5">
              <input value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-blue-500" placeholder={t('topicPlaceholder')} />
              <div className="grid gap-3">
                {selectedScenario.personas.map(p => (
                  <button key={p.id} onClick={() => setSelectedPersona(p)} className={`flex items-center p-4 rounded-2xl border transition-all ${selectedPersona?.id === p.id ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-800'}`}>
                    <i className={`fas ${p.icon} w-8`}></i>
                    <div className="text-left"><p className="font-bold text-sm">{p.name[lang]}</p></div>
                  </button>
                ))}
              </div>
              <button onClick={handleStartSession} className="w-full py-5 bg-blue-600 rounded-3xl text-white font-black text-lg shadow-2xl active:scale-95 transition-all">ENGAGE</button>
            </div>
          </div>
        )}

        {activeScreen === 'practice' && (
          <div className="h-full flex flex-col items-center justify-center space-y-8 animate-fadeIn py-10">
            {/* Pace Control and Coaching Toggle */}
            <div className="w-full flex justify-between items-center px-4">
              <PaceController 
                currentPace={currentPace}
                onPaceChange={handlePaceChange}
                disabled={!isSessionActive}
                lang={lang}
              />
              <SuggestionToggle
                enabled={suggestionsEnabled}
                onToggle={handleSuggestionsToggle}
                disabled={!isSessionActive}
                lang={lang}
              />
            </div>

            <div className="text-center space-y-4">
              <div className="w-40 h-40 rounded-[3rem] bg-slate-900 border-2 border-blue-500 flex items-center justify-center text-5xl text-blue-500"><i className={`fas ${selectedPersona?.icon}`}></i></div>
              <h3 className="text-2xl font-black">{selectedPersona?.name[lang]}</h3>
            </div>
            
            <div className="w-full min-h-[160px] bg-slate-900/50 rounded-[2.5rem] border border-slate-800/50 p-6 flex flex-col justify-center relative">
               <VoiceVisualizer color="bg-blue-500" />
               <p className="mt-4 text-center text-sm italic text-slate-400 animate-pulse">{lastTranscription || "Listening..."}</p>
               <LiveMetrics 
                 energy={liveEnergy} 
                 pace={livePace} 
                 lang={lang} 
                 onCoachingAnalysis={handleCoachingAnalysis}
               />
            </div>
            
            <button onClick={handleEndSession} className="w-full max-w-xs py-5 rounded-[2rem] font-black bg-red-600 shadow-xl transition-all active:scale-95">FINISH</button>
          </div>
        )}

        {activeScreen === 'results' && analysisResult && (
          <div className="space-y-8 animate-fadeIn">
            <h2 className="text-3xl font-black text-center">{t('feedbackTitle')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-6 rounded-[2rem] text-center"><p className="text-3xl font-black text-blue-500">{analysisResult.confidenceScore}%</p><p className="text-[10px] text-slate-500 uppercase tracking-widest">Confidence</p></div>
              <div className="bg-slate-900 p-6 rounded-[2rem] text-center"><p className="text-3xl font-black">{analysisResult.effectivenessScore}%</p><p className="text-[10px] text-slate-500 uppercase tracking-widest">Effectiveness</p></div>
            </div>
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800"><p className="text-slate-300 italic">"{analysisResult.feedback}"</p></div>
            
            {analysisResult.troubleWords && analysisResult.troubleWords.length > 0 && (
              <button onClick={() => setShowWorkshop(true)} className="w-full py-4 bg-blue-600/20 border border-blue-500/30 rounded-2xl text-blue-400 font-bold flex items-center justify-center gap-3">
                <i className="fas fa-microphone-alt"></i> OPEN PRONUNCIATION WORKSHOP
              </button>
            )}

            <button onClick={() => setActiveScreen('home')} className="w-full py-5 bg-white text-slate-950 font-black rounded-3xl transition-all active:scale-95">RETURN TO BASE</button>
          </div>
        )}

        {activeScreen === 'stats' && (
          <div className="space-y-8 animate-fadeIn">
            <h2 className="text-3xl font-black">{t('stats')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-[2rem] bg-slate-900 border border-slate-800"><h4 className="text-3xl font-black">{history.length}</h4><p className="text-[10px] text-slate-500 uppercase">Sessions</p></div>
              <div className="p-6 rounded-[2rem] bg-slate-900 border border-slate-800"><h4 className="text-3xl font-black text-blue-500">{history.length > 0 ? Math.round(history.reduce((a,c)=>a+c.confidenceScore,0)/history.length) : 0}%</h4><p className="text-[10px] text-slate-500 uppercase tracking-widest">Avg Conf</p></div>
            </div>
            <div className="space-y-4">
               {history.map(item => (
                 <div key={item.id} className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl flex items-center justify-between">
                    <div><p className="font-bold text-sm">{item.personaName}</p><p className="text-[10px] text-slate-500">{item.date}</p></div>
                    <p className="text-blue-500 font-black">{item.confidenceScore}%</p>
                 </div>
               ))}
            </div>
          </div>
        )}
      </main>

      {['home', 'stats', 'profile'].includes(activeScreen) && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-2xl border-t border-slate-900 px-8 py-4 flex justify-between items-center z-50">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveScreen(item.id as any)} className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${activeScreen === item.id ? 'text-blue-500' : 'text-slate-600'}`}>
              <i className={`fas ${item.icon} text-xl`}></i>
              <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Coaching Suggestion Display */}
      <SuggestionDisplay 
        suggestion={currentSuggestion}
        onDismiss={handleSuggestionDismiss}
        onExpand={handleSuggestionExpand}
        lang={lang}
      />

      {showWorkshop && (
        <PronunciationWorkshop 
          items={lastTroubleWords.length > 0 ? lastTroubleWords : []} 
          lang={lang} 
          coach={coachRef.current} 
          onClose={() => setShowWorkshop(false)} 
        />
      )}
    </div>
  );
};

export default App;
