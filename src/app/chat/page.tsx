'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, LogOut, Sparkles, Book, FileUp, X, CheckCircle2, Trash2, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { storeKnowledge, deleteKnowledge } from '@/app/actions/knowledge';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const WEBHOOK_INIT_URL = process.env.NEXT_PUBLIC_WEBHOOK_INIT_URL || '';
const WEBHOOK_SUBMIT_URL = process.env.NEXT_PUBLIC_WEBHOOK_SUBMIT_URL || '';
const WEBHOOK_CHAT_URL = process.env.NEXT_PUBLIC_WEBHOOK_CHAT_URL || '';

type Profile = { batata_name: string; avatar: string; language: string; usage_purpose: string; customized: boolean; };
type Message = { role: 'bot' | 'user'; content: string; choices?: string[]; _index?: number; _allQuestions?: any[]; created_at?: string; };
type Phase = 'mcq' | 'submitting' | 'chat';

export default function ChatPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phase, setPhase] = useState<Phase>('mcq');
  const [messages, setMessages] = useState<Message[]>([]);
  const [interactions, setInteractions] = useState<{ question: string; answer: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [knowledgeFiles, setKnowledgeFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedLang = localStorage.getItem('batata_lang') as 'en' | 'ar';
    if (savedLang) setLang(savedLang);

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: profileData } = await supabase
        .schema('batata')
        .from('profiles')
        .select('batata_name, avatar, language, usage_purpose, username, customized')
        .eq('id', session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        
        if (profileData.customized) {
          loadHistory(session.user.id);
        } else {
          startMCQ(profileData);
        }
      }
    };
    init();
  }, [router]);

  const loadHistory = async (userId: string) => {
    setLoading(true);
    const { data: history } = await supabase
      .schema('batata')
      .from('messages')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(30);

    if (history && history.length > 0) {
      setMessages(history as Message[]);
    } else {
      // If no history yet but customized is true
      const isAr = localStorage.getItem('batata_lang') === 'ar';
      setMessages([{ 
        role: 'bot', 
        content: isAr ? 'أهلاً بك مجددًا! كيف يمكنني مساعدتك اليوم؟' : 'Welcome back! How can I help you today?' 
      }]);
    }
    setPhase('chat');
    setLoading(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping]);

  useEffect(() => {
    if (showKnowledge) {
      fetchFiles();
    }
  }, [showKnowledge]);

  const fetchFiles = async () => {
    setIsLoadingFiles(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .schema('batata')
      .from('knowledge')
      .select('filename')
      .eq('user_id', session.user.id);

    if (data) {
      // Get unique filenames
      const uniqueFiles = Array.from(new Set(data.map(f => f.filename)));
      setKnowledgeFiles(uniqueFiles);
    }
    setIsLoadingFiles(false);
  };

  // ─── PHASE 1: MCQ ─────────────────────────────────────────────────────────
  const startMCQ = async (prof: Profile) => {
    setLoading(true);
    const isAr = localStorage.getItem('batata_lang') === 'ar';
    const welcome = isAr
      ? `أهلاً! أنا ${prof.batata_name} ${prof.avatar}. دعني أطرح عليك بعض الأسئلة لأفهمك أكثر...`
      : `Hey! I'm ${prof.batata_name} ${prof.avatar}. Let me ask you a few questions to get to know you better...`;

    setMessages([{ role: 'bot', content: welcome }]);

    try {
      let questions = null;
      const stored = localStorage.getItem('batata_init_data');
      if (stored) {
        const data = JSON.parse(stored);
        questions = data?.questions;
        localStorage.removeItem('batata_init_data');
      }

      if (!questions && WEBHOOK_INIT_URL) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(WEBHOOK_INIT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: session.user.id,
              username: session.user.user_metadata?.username,
              batata_name: prof.batata_name,
              avatar: prof.avatar,
              language: prof.language,
              usage_purpose: prof.usage_purpose
            })
          });
          if (res.ok) {
            const text = await res.text();
            let data = text ? JSON.parse(text) : null;
            
            // Handle n8n [ { output: { questions: [...] } } ] format
            if (Array.isArray(data)) data = data[0];
            questions = data?.output?.questions || data?.questions;
          }
        }
      }

      // ─── Format questions from n8n structure ───
      // n8n structure: [ { "Question1": ["Text", "A", "B", "C", "D"] }, ... ]
      if (Array.isArray(questions)) {
        questions = questions.map((item: any) => {
          // Get the first key's value (e.g. Question1)
          const keys = Object.keys(item);
          if (keys.length > 0) {
            const arr = item[keys[0]];
            if (Array.isArray(arr)) {
              return {
                text: arr[0],
                choices: arr.slice(1).map((c: string) => 
                  // Strip common prefixes like A) , 1. , أ) etc.
                  c.replace(/^[A-Za-z0-9أ-ي]\s*[.)-]\s*/, '').trim()
                )
              };
            }
          }
          return item; // Fallback if already in correct format
        });
      }

      // Fallback questions if webhook returns nothing
      if (!questions) {
        questions = [
          { text: "What's your main goal?", choices: ["Learn something new", "Get things done", "Have fun", "Solve problems"] },
          { text: "How do you prefer information?", choices: ["Detailed explanations", "Short & simple", "With examples", "Bullet points"] },
          { text: "How often will you use me?", choices: ["Daily", "A few times a week", "Occasionally", "Just testing"] },
          { text: "What's your expertise level?", choices: ["Beginner", "Intermediate", "Advanced", "Expert"] },
          { text: "What tone do you prefer?", choices: ["Friendly & casual", "Professional", "Funny & sarcastic", "Motivational"] },
        ];
      }

      addNextQuestion(questions, 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addNextQuestion = (questions: any[], index: number) => {
    if (index >= questions.length) {
      submitAnswers();
      return;
    }
    const q = questions[index];
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: q.text,
        choices: q.choices,
        _index: index,
        _allQuestions: questions
      }]);
    }, 300);
  };

  const handleChoiceSelect = async (choice: string, qText: string, allQuestions: any[], index: number) => {
    setMessages(prev => [...prev, { role: 'user', content: choice }]);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.schema('batata').from('interactions').insert({
        user_id: session.user.id,
        question: qText,
        answer: choice
      });
    }

    const updated = [...interactions, { question: qText, answer: choice }];
    setInteractions(updated);

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      addNextQuestion(allQuestions, index + 1);
    }, 600);
  };

  // ─── PHASE 2: SUBMIT ANSWERS → n8n creates system prompt ─────────────────
  const submitAnswers = async () => {
    setPhase('submitting');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && WEBHOOK_SUBMIT_URL) {
        const res = await fetch(WEBHOOK_SUBMIT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: session.user.id,
            username: session.user.user_metadata?.username,
            answers: interactions
          })
        });

        if (res.ok) {
          const text = await res.text();
          const data = text ? JSON.parse(text) : null;

          // If n8n returns the system prompt, save it to the profile
          if (data?.system_prompt) {
            await supabase.schema('batata').from('profiles')
              .update({ system_prompt: data.system_prompt })
              .eq('id', session.user.id);
          }
        }
      }
    } catch (err) {
      console.error('Submit error:', err);
    }

    // Transition to free chat
    const isAr = localStorage.getItem('batata_lang') === 'ar';
    const readyMsg = isAr
      ? `${profile?.avatar} بطاطتك جاهزة! يمكنك الآن التحدث معي بحرية 🎉`
      : `${profile?.avatar} Your Batata is ready! You can now chat with me freely 🎉`;

    setMessages(prev => [...prev, { role: 'bot', content: readyMsg }]);
    setPhase('chat');
  };

  // ─── PHASE 3: FREE CHAT ───────────────────────────────────────────────────
  const sendMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || isBotTyping) return;

    setChatInput('');
    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setIsBotTyping(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Save user message to DB
        await supabase.schema('batata').from('messages').insert({
          user_id: session.user.id,
          role: 'user',
          content: msg
        });
      }
      
      if (!WEBHOOK_CHAT_URL || WEBHOOK_CHAT_URL.includes('REPLACE_WITH_CHAT_WEBHOOK')) {
        setMessages(prev => [...prev, { role: 'bot', content: '⚠️ Chat Webhook not configured. Please add the real URL to your .env.local file.' }]);
        return;
      }

      const res = await fetch(WEBHOOK_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session?.user?.id,
          message: msg,
          rag_enabled: ragEnabled,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (res.ok) {
        const text = await res.text();
        let data = text ? JSON.parse(text) : null;
        
        // Handle n8n [ { output: { message: "..." } } ] format
        if (Array.isArray(data)) data = data[0];
        const reply = data?.output?.message || data?.message || data?.reply || data?.output || 'I received your message!';
        
        const botMsg: Message = { role: 'bot', content: reply };
        setMessages(prev => [...prev, botMsg]);

        // Save bot response to DB
        if (session) {
          await supabase.schema('batata').from('messages').insert({
            user_id: session.user.id,
            role: 'bot',
            content: reply
          });
        }
      } else {
        throw new Error('Webhook responded with error');
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'bot', content: '🚫 Connection failed. Please check your internet or the webhook URL.' }]);
    } finally {
      setIsBotTyping(false);
      // Auto-focus the input after bot replies or error
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not logged in');

      // 1. Read and parse PDF on the CLIENT
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + ' ';
      }

      if (!fullText.trim()) throw new Error('No text found in PDF');

      // 2. Chunk text
      const chunkSize = 1000;
      const overlap = 200;
      const chunks: string[] = [];
      let i = 0;
      while (i < fullText.length) {
        chunks.push(fullText.slice(i, i + chunkSize));
        i += (chunkSize - overlap);
        if (chunks.length > 500) break; 
      }

      // 3. Store chunks on server
      const result = await storeKnowledge(session.user.id, file.name, chunks);
      
      if (result.success) {
        setUploadStatus('success');
        fetchFiles(); // Refresh list
        setTimeout(() => {
          setUploadStatus('idle');
        }, 2000);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error('Client Parse Error:', err);
      setUploadStatus('error');
      alert(err.message || 'Error processing PDF');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(isAr ? `هل أنت متأكد من حذف ${filename}؟` : `Are you sure you want to delete ${filename}?`)) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const result = await deleteKnowledge(session.user.id, filename);
    if (result.success) {
      fetchFiles();
    } else {
      alert(result.error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <Loader2 className="animate-spin" size={40} color="var(--primary)" />
    </div>
  );

  // ─── SUBMITTING LOADING SCREEN ────────────────────────────────────────────
  if (phase === 'submitting') {
    const isAr = lang === 'ar';
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', gap: '24px'
      }}>
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [0, 3, -3, 0] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          style={{ fontSize: '80px', filter: 'drop-shadow(0 0 24px rgba(245,158,11,0.5))' }}
        >
          {profile.avatar}
        </motion.div>
        {[0,1,2].map(i => (
          <motion.div key={i}
            style={{ position: 'absolute', width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', filter: 'blur(2px)', top: '38%', left: '50%' }}
            animate={{ opacity: [0,1,0], y: -60, x: (i-1)*22 }}
            transition={{ repeat: Infinity, duration: 2, delay: i * 0.65 }}
          />
        ))}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)', marginBottom: '8px', fontWeight: '700' }}>
            {isAr ? 'جاري إنشاء مساعدك الشخصي...' : 'Building your personal assistant...'}
          </h2>
          <p style={{ color: '#a0a0a0' }}>
            {isAr ? 'نحن نُعدّ نظام الذكاء الاصطناعي الخاص بك' : 'We\'re setting up your AI system'}
          </p>
        </div>
        <Loader2 className="animate-spin" size={28} color="var(--primary)" />
      </div>
    );
  }

  // ─── CHAT UI ─────────────────────────────────────────────────────────────
  const isAr = lang === 'ar';

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#0a0a0a', color: 'white'
    }}>
      {/* Header */}
      <header className="glass" style={{
        padding: '14px 20px', margin: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            fontSize: '1.8rem', width: '44px', height: '44px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(245,158,11,0.1)', borderRadius: '50%',
            border: '2px solid rgba(245,158,11,0.3)'
          }}>{profile.avatar}</div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '1rem' }}>{profile.batata_name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
              {phase === 'mcq' ? (isAr ? '🔵 يسألك الآن' : '🔵 Getting to know you') : (isAr ? '🟢 جاهز للدردشة' : '🟢 Ready to chat')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setShowKnowledge(true)}
            style={{ background: 'rgba(255,255,255,0.05)', color: '#a0a0a0', padding: '10px', borderRadius: '12px' }}
          >
            <Book size={20} />
          </button>
          <button onClick={handleLogout} style={{ background: 'transparent', color: '#a0a0a0', padding: '8px' }}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '0 16px 16px',
        display: 'flex', flexDirection: 'column', gap: '16px'
      }}>
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              style={{ 
                display: 'flex', 
                flexDirection: msg.role === 'user' ? 'row' : 'row', // Let dir handle it
                justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end', 
                gap: '10px' 
              }}
            >
              {msg.role === 'bot' && (
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(245,158,11,0.15)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                  border: '1px solid rgba(245,158,11,0.3)',
                  order: isAr ? 2 : 1 // Avatar on left for LTR, right for RTL
                }}>{profile.avatar}</div>
              )}
              <div style={{ 
                maxWidth: '85%',
                order: msg.role === 'bot' ? (isAr ? 1 : 2) : 1
              }}>
                <div className="markdown-content" style={{
                  padding: '10px 16px', 
                  borderRadius: msg.role === 'user' 
                    ? (isAr ? '16px 4px 16px 16px' : '4px 16px 16px 16px') 
                    : (isAr ? '16px 16px 4px 16px' : '16px 16px 16px 4px'),
                  background: msg.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  color: msg.role === 'user' ? '#000' : '#fff',
                  border: msg.role === 'bot' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  fontSize: '0.95rem', lineHeight: '1.5',
                  boxShadow: msg.role === 'user' ? '0 4px 15px rgba(245,158,11,0.2)' : 'none'
                }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* MCQ Choices */}
                {msg.role === 'bot' && msg.choices && (
                  <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {msg.choices.map((choice, ci) => (
                      <button key={ci}
                        onClick={() => handleChoiceSelect(choice, msg.content, msg._allQuestions!, msg._index!)}
                        disabled={i !== messages.length - 1 || loading}
                        style={{
                          padding: '8px 16px', fontSize: '0.88rem', borderRadius: '20px', fontWeight: '600',
                          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                          color: 'var(--primary)', cursor: 'pointer', transition: 'all 0.2s',
                          opacity: i !== messages.length - 1 ? 0.4 : 1
                        }}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Bot typing indicator */}
        {(loading || isBotTyping) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ 
              display: 'flex', gap: '10px', alignItems: 'center',
              justifyContent: 'flex-end' 
            }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: 'rgba(245,158,11,0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
              order: isAr ? 2 : 1
            }}>{profile.avatar}</div>
            <div style={{
              padding: '12px 16px', borderRadius: '16px 16px 4px 16px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', gap: '4px', alignItems: 'center',
              order: isAr ? 1 : 2
            }}>
              {[0,1,2].map(i => (
                <motion.div key={i}
                  animate={{ y: [0,-6,0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: i*0.15 }}
                  style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)' }}
                />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — only active in free chat phase */}
      <div style={{ padding: '12px 16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {phase === 'mcq' ? (
          <div style={{ textAlign: 'center', color: '#555', fontSize: '0.85rem', padding: '8px' }}>
            <Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />
            {isAr ? 'اختر أحد الخيارات أعلاه' : 'Pick a choice above to continue'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* RAG Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px' }}>
              <button 
                onClick={() => setRagEnabled(!ragEnabled)}
                style={{
                  width: '40px', height: '22px', borderRadius: '20px',
                  background: ragEnabled ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                  position: 'relative', transition: 'all 0.3s', cursor: 'pointer',
                  padding: 0, border: 'none'
                }}
              >
                <motion.div 
                  animate={{ x: ragEnabled ? (isAr ? -20 : 20) : 0 }}
                  style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: ragEnabled ? 'black' : 'white',
                    position: 'absolute', top: '3px', left: isAr ? 'auto' : '3px', right: isAr ? '3px' : 'auto'
                  }}
                />
              </button>
              <span style={{ fontSize: '0.85rem', color: ragEnabled ? 'var(--primary)' : '#888', fontWeight: '600' }}>
                {isAr ? 'الإجابة من ملفات PDF' : 'Answer from PDF'}
              </span>
            </div>

            <div className="glass" style={{ display: 'flex', padding: '6px', gap: '10px', alignItems: 'center' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder={isAr ? 'اكتب رسالتك...' : 'Type your message...'}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              style={{ border: 'none', background: 'transparent', flex: 1, fontSize: '0.95rem' }}
              disabled={isBotTyping}
            />
            <button
              onClick={sendMessage}
              disabled={!chatInput.trim() || isBotTyping}
              className="btn-primary"
              style={{
                padding: '10px', borderRadius: '10px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                opacity: !chatInput.trim() || isBotTyping ? 0.4 : 1
              }}
            >
              <Send size={18} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
            </button>
            </div>
          </div>
        )}
      </div>
      {/* Knowledge Modal */}
      <AnimatePresence>
        {showKnowledge && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', backdropFilter: 'blur(8px)'
          }}>
            <motion.div
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              className="glass"
              style={{ 
                width: '100%', 
                maxWidth: '500px', 
                margin: 'auto',
                padding: '24px', 
                position: 'relative',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
            >
              <button onClick={() => setShowKnowledge(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', color: '#666' }}>
                <X size={20} />
              </button>

              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '18px', background: 'rgba(245,158,11,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--primary)'
                }}>
                  <Book size={32} />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px' }}>
                  {isAr ? 'قاعدة المعرفة' : 'Knowledge Base'}
                </h2>
                <p style={{ color: '#a0a0a0', fontSize: '0.9rem' }}>
                  {isAr ? 'أضف أو احذف ملفات PDF لتدريب البطاطا' : 'Manage PDF files to train your Batata'}
                </p>
              </div>

              {/* File List */}
              <div style={{ marginBottom: '24px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                {isLoadingFiles ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}><Loader2 className="animate-spin" size={20} color="#666" /></div>
                ) : knowledgeFiles.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {knowledgeFiles.map(file => (
                      <div key={file} className="glass" style={{ 
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', 
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <FileText size={16} color="var(--primary)" />
                        <span style={{ flex: 1, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file}
                        </span>
                        <button 
                          onClick={() => handleDeleteFile(file)}
                          style={{ background: 'transparent', color: '#ef4444', padding: '4px', opacity: 0.6 }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85rem', padding: '10px' }}>
                    {isAr ? 'لا توجد ملفات مرفوعة' : 'No files uploaded yet'}
                  </p>
                )}
              </div>

              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '16px', padding: '40px 20px',
                cursor: isUploading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                background: 'rgba(255,255,255,0.02)'
              }}>
                {isUploading ? (
                  <div style={{ textAlign: 'center' }}>
                    <Loader2 className="animate-spin" size={32} color="var(--primary)" style={{ marginBottom: '12px' }} />
                    <p>{isAr ? 'جاري التحليل والتقطيع...' : 'Parsing & Chunking...'}</p>
                  </div>
                ) : uploadStatus === 'success' ? (
                  <div style={{ textAlign: 'center', color: '#10b981' }}>
                    <CheckCircle2 size={40} style={{ marginBottom: '12px' }} />
                    <p>{isAr ? 'تم الرفع بنجاح!' : 'Uploaded successfully!'}</p>
                  </div>
                ) : (
                  <>
                    <FileUp size={40} color="var(--primary)" style={{ marginBottom: '16px', opacity: 0.7 }} />
                    <p style={{ fontWeight: '600' }}>{isAr ? 'اضغط لرفع ملف PDF' : 'Click to upload PDF'}</p>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px' }}>Max 10MB</p>
                  </>
                )}
                <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} disabled={isUploading} />
              </label>

              {uploadStatus === 'error' && (
                <p style={{ color: '#ef4444', textAlign: 'center', marginTop: '12px', fontSize: '0.85rem' }}>
                  {isAr ? 'حدث خطأ أثناء الرفع' : 'Error uploading file'}
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
