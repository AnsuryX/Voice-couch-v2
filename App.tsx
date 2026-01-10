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
import { supabase } from './services/supabaseClient.ts';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const [isRTL, setIsRTL] = useState(false);
  const [activeScreen, setActiveScreen] = useState<'loading' | 'home' | 'customize' | 'practice' | 'results' | 'stats' | 'profile'>('loading');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // User State
  const [user, setUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

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
  const [selectedSessionHistory, setSelectedSessionHistory] = useState<SessionResult | null>(null);

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

  // Supabase Auth and User Profile Integration
  useEffect(() => {
    // 1. Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setActiveScreen('home');
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser) {
        fetchUserData(newUser.id);
      } else {
        setActiveScreen('home');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch data from Supabase
  const fetchUserData = async (userId: string) => {
    try {
      // Fetch Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      } else if (profileData) {
        setProfile({
          name: profileData.name || '',
          bio: profileData.bio || '',
          goal: profileData.goal || '',
          preferredTone: (profileData.preferred_tone as any) || 'supportive',
          joinedDate: new Date(profileData.created_at).toLocaleDateString()
        });
      }

      // Fetch History
      const { data: historyData, error: historyError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (historyError) {
        console.error('Error fetching history:', historyError);
      } else if (historyData) {
        const formattedHistory: SessionResult[] = historyData.map((s: any) => ({
          id: s.id,
          date: new Date(s.created_at).toLocaleDateString(),
          scenarioType: s.scenario_type,
          confidenceScore: s.confidence_score,
          effectivenessScore: s.effectiveness_score,
          feedback: s.feedback,
          duration: s.duration,
          personaName: s.persona_name,
          recordingTurns: s.recording_turns
        }));
        setHistory(formattedHistory);
      }

      setActiveScreen('home');
    } catch (err) {
      console.error('Unexpected error in fetchUserData:', err);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || "Sign in failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setErrorMsg("Check your email for the confirmation link!");
    } catch (err: any) {
      setErrorMsg(err.message || "Sign up failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || "Google sign in failed.");
    }
  };



  const wipeHistory = async () => {
    if (!user) return;
    if (!confirm("Are you sure you want to wipe all session history? This cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setHistory([]);
      setErrorMsg("History cleared.");
      setTimeout(() => setErrorMsg(null), 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to clear history.");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setHistory([]);
    setProfile({
      name: '',
      bio: '',
      goal: '',
      preferredTone: 'supportive',
      joinedDate: ''
    });
    setUser(null);
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
      }, profile);
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

      // Store session in Supabase
      if (user) {
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            user_id: user.id,
            scenario_type: selectedScenario!.type,
            confidence_score: res.confidenceScore,
            effectiveness_score: res.effectivenessScore,
            feedback: res.feedback,
            duration: duration,
            persona_name: selectedPersona!.name[lang],
            recording_turns: recordedTurns
          })
          .select()
          .single();

        if (sessionError) {
          console.error('Error saving session:', sessionError);
        } else if (sessionData) {
          const newSession: SessionResult = {
            id: sessionData.id,
            date: new Date(sessionData.created_at).toLocaleDateString(),
            scenarioType: sessionData.scenario_type,
            confidenceScore: sessionData.confidence_score,
            effectivenessScore: sessionData.effectiveness_score,
            feedback: sessionData.feedback,
            duration: sessionData.duration,
            personaName: sessionData.persona_name,
            recordingTurns: sessionData.recording_turns
          };
          setHistory(prev => [newSession, ...prev]);
        }
      }

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
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          bio: profile.bio,
          goal: profile.goal,
          preferred_tone: profile.preferredTone
        })
        .eq('id', user.id);

      if (error) throw error;

      setErrorMsg("Profile saved successfully!");
      setTimeout(() => setErrorMsg(null), 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save profile.");
    }
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
      <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-white space-y-8 animate-fadeIn">
        <div className="w-16 h-16 rounded-[2rem] bg-blue-600 flex items-center justify-center animate-pulse shadow-[0_0_50px_-12px_rgba(37,99,235,0.5)]">
          <i className="fas fa-bullseye text-2xl"></i>
        </div>
        {!user && (
          <div className="flex flex-col items-center gap-6 animate-slideUp w-full max-w-sm px-6">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-black tracking-tighter uppercase italic">VocalEdge</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Master Your Voice</p>
            </div>

            <form onSubmit={authMode === 'login' ? handleEmailSignIn : handleEmailSignUp} className="w-full space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500 text-sm"
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500 text-sm"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
              >
                {authLoading ? 'PROCESSING...' : (authMode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT')}
              </button>
            </form>

            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex items-center gap-4 w-full">
                <div className="h-px bg-slate-800 flex-1"></div>
                <span className="text-[10px] text-slate-600 font-bold">OR</span>
                <div className="h-px bg-slate-800 flex-1"></div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                className="w-full py-4 bg-slate-100 hover:bg-white text-slate-950 font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 border border-slate-200"
              >
                <i className="fab fa-google text-blue-600 text-lg"></i>
                <span className="tracking-tight">CONTINUE WITH GOOGLE</span>
              </button>
            </div>

            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-[10px] text-blue-500 font-black uppercase tracking-widest hover:underline"
            >
              {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>

            <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center max-w-[220px] leading-relaxed opacity-50 mt-4">
              Your voice metrics are private and protected by Supabase
            </p>
          </div>
        )}
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
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-blue-500 animate-fadeIn">{t('welcome')}{profile.name ? `, ${profile.name}` : ''}</h2>
              <p className="text-slate-500 text-sm mt-1 font-medium tracking-tight">Select a training scenario to begin your evolution.</p>
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
            {user ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('userName')}</label>
                  <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('userGoal')}</label>
                  <textarea value={profile.goal} onChange={e => setProfile({ ...profile, goal: e.target.value })} className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500 h-24" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('toneVibe')}</label>
                  <select value={profile.preferredTone} onChange={e => setProfile({ ...profile, preferredTone: e.target.value as any })} className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500">
                    <option value="supportive">Supportive Coach</option>
                    <option value="brutal">Brutal Honesty</option>
                  </select>
                </div>
                <button onClick={saveProfile} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 hover:bg-blue-500 hover:shadow-blue-500/20">{t('saveProfile')}</button>
                <div className="pt-6 space-y-4">
                  <button onClick={wipeHistory} className="w-full p-5 rounded-2xl bg-red-900/10 border border-red-500/10 flex items-center justify-between group active:bg-red-900/20">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500"><i className="fas fa-fire"></i></div>
                      <span className="font-bold text-sm text-red-400">{t('settingsClearData')}</span>
                    </div>
                    <i className="fas fa-chevron-right text-red-900/50"></i>
                  </button>
                  <button onClick={handleSignOut} className="w-full p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-3 active:bg-slate-800 transition-all">
                    <i className="fas fa-sign-out-alt text-slate-500"></i>
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto">
                <form onSubmit={authMode === 'login' ? handleEmailSignIn : handleEmailSignUp} className="w-full space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500 text-sm"
                      placeholder="name@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500 text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                  >
                    {authLoading ? 'PROCESSING...' : (authMode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT')}
                  </button>
                </form>

                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="flex items-center gap-4 w-full">
                    <div className="h-px bg-slate-800 flex-1"></div>
                    <span className="text-[10px] text-slate-600 font-bold">OR</span>
                    <div className="h-px bg-slate-800 flex-1"></div>
                  </div>

                  <button
                    onClick={handleGoogleSignIn}
                    className="w-full py-4 bg-slate-100 hover:bg-white text-slate-950 font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 border border-slate-200"
                  >
                    <i className="fab fa-google text-blue-600 text-lg"></i>
                    <span className="tracking-tight">CONTINUE WITH GOOGLE</span>
                  </button>
                </div>

                <button
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-[10px] text-blue-500 font-black uppercase tracking-widest hover:underline"
                >
                  {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                </button>
              </div>
            )}
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
              <div className="p-6 rounded-[2rem] bg-slate-900 border border-slate-800"><h4 className="text-3xl font-black text-blue-500">{history.length > 0 ? Math.round(history.reduce((a, c) => a + c.confidenceScore, 0) / history.length) : 0}%</h4><p className="text-[10px] text-slate-500 uppercase tracking-widest">Avg Conf</p></div>
            </div>
            <div className="space-y-4">
              {history.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedSessionHistory(item)}
                  className="w-full text-left p-4 bg-slate-900/40 border border-slate-900 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all hover:bg-slate-900/60"
                >
                  <div>
                    <p className="font-bold text-sm group-hover:text-blue-400 transition-colors">{item.personaName}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">{item.date} • {Math.floor(item.duration / 60)}m {item.duration % 60}s</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-blue-500 font-black">{item.confidenceScore}%</p>
                    <i className="fas fa-chevron-right text-slate-800 text-xs group-hover:text-blue-500/50 transition-colors"></i>
                  </div>
                </button>
              ))}
              {history.length === 0 && (
                <div className="text-center py-12 opacity-30">
                  <i className="fas fa-history text-4xl mb-4"></i>
                  <p className="text-xs uppercase tracking-[0.2em]">{t('noHistory')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Session Detail Modal */}
      {selectedSessionHistory && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-slideUp">
          <header className="px-6 py-6 flex justify-between items-center border-b border-white/5 sticky top-0 bg-slate-950/80 backdrop-blur-xl">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter italic">{t('missionDebrief')}</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{selectedSessionHistory.personaName} • {selectedSessionHistory.date}</p>
            </div>
            <button
              onClick={() => setSelectedSessionHistory(null)}
              className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 active:scale-90 transition-all"
            >
              <i className="fas fa-times"></i>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-32">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 text-center">
                <p className="text-4xl font-black text-blue-500 mb-1">{selectedSessionHistory.confidenceScore}%</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t('confidence')}</p>
              </div>
              <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 text-center">
                <p className="text-4xl font-black text-white mb-1">{selectedSessionHistory.effectivenessScore}%</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t('effectiveness')}</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{t('theAnalysis')}</label>
              <div className="bg-blue-600/5 border border-blue-500/10 p-6 rounded-[2.5rem]">
                <p className="text-slate-300 italic leading-relaxed">"{selectedSessionHistory.feedback}"</p>
              </div>
            </div>

            {selectedSessionHistory.recordingTurns && selectedSessionHistory.recordingTurns.length > 0 && (
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{t('recordingTurns')}</label>
                <div className="space-y-6">
                  {selectedSessionHistory.recordingTurns.map((turn, idx) => (
                    <div key={idx} className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-2 px-2">
                        {turn.role === 'user' ? t('rolePilot') : t('roleCoach')}
                      </span>
                      <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-medium leading-relaxed ${turn.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-slate-900 text-slate-300 rounded-tl-none border border-white/5'
                        }`}>
                        {turn.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-950/80 backdrop-blur-xl border-t border-white/5">
            <button
              onClick={() => setSelectedSessionHistory(null)}
              className="w-full py-5 bg-white text-slate-950 font-black rounded-3xl shadow-2xl active:scale-95 transition-all"
            >
              {t('closeDebrief').toUpperCase()}
            </button>
          </div>
        </div>
      )}

      {['home', 'stats', 'profile'].includes(activeScreen) && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-2xl border-t border-slate-900 px-8 py-4 flex justify-between items-center z-50">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveScreen(item.id as any)} className={`flex flex-col items-center gap-1 transition-all active:scale-90 relative ${activeScreen === item.id ? 'text-blue-500' : 'text-slate-600'}`}>
              {activeScreen === item.id && (
                <div className="absolute -top-1 w-1 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse"></div>
              )}
              <i className={`fas ${item.icon} text-xl ${activeScreen === item.id ? 'drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''}`}></i>
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
