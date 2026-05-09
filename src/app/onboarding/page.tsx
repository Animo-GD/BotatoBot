'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Languages, Target, ChevronRight, ChevronLeft, Check, User, MessageSquare, AlignLeft, Loader2 } from 'lucide-react';

const EMOJI_OPTIONS = ['🥔', '🍟', '🥗', '🥘', '👨‍🍳', '👩‍🍳', '🥔✨', '🤖'];
const LANGUAGES = ['English', 'Arabic', 'Spanish', 'French', 'German', 'Japanese'];

const translations = {
  en: {
    step1Title: 'Name your Batata',
    step1Subtitle: 'Every great chatbot needs an identity.',
    step1Placeholder: 'e.g. Spuddy, Sir Mashalot',
    step2Title: 'Choose an Avatar',
    step2Subtitle: 'Pick the emoji that represents your spud.',
    step3Title: 'Select Language',
    step3Subtitle: 'What language will your Batata speak?',
    step4Title: 'Usage Purpose',
    step4Subtitle: 'What will you use your Batata for?',
    step4Placeholder: 'e.g. For cooking tips, daily motivation, or just a friend to talk to...',
    step5Title: 'What\'s your name?',
    step5Subtitle: 'How should your Batata call you?',
    step5Placeholder: 'e.g. Alex, Captain, Boss...',
    step6Title: 'Preferred Tone',
    step6Subtitle: 'How should your Batata talk to you?',
    step7Title: 'Response Style',
    step7Subtitle: 'How long should my answers be?',
    btnContinue: 'Continue',
    btnBack: 'Back',
    btnFinish: 'Finish Setup',
    btnPlanting: 'Planting...',
  },
  ar: {
    step1Title: 'سمِّ البطاطا الخاصة بك',
    step1Subtitle: 'كل بوت ذكي يحتاج إلى هوية.',
    step1Placeholder: 'مثلاً: بطاطس، مستر مهروس',
    step2Title: 'اختر الرمز التعبيري',
    step2Subtitle: 'اختر الرمز الذي يمثل حبة البطاطس الخاصة بك.',
    step3Title: 'اختر اللغة',
    step3Subtitle: 'بأي لغة ستتحدث البطاطا الخاصة بك؟',
    step4Title: 'غرض الاستخدام',
    step4Subtitle: 'فيما ستستخدم البطاطا الخاصة بك؟',
    step4Placeholder: 'مثلاً: لنصائح الطبخ، التحفيز اليومي، أو مجرد صديق للتحدث معه...',
    step5Title: 'ما اسمك؟',
    step5Subtitle: 'كيف تريد أن تناديك البطاطا؟',
    step5Placeholder: 'مثلاً: كابتن، بطل، حبيبي...',
    step6Title: 'الأسلوب المفضل',
    step6Subtitle: 'كيف تريد أن تتحدث معك البطاطا؟',
    step7Title: 'طول الردود',
    step7Subtitle: 'كم تريد أن تكون إجاباتي؟',
    btnContinue: 'استمرار',
    btnBack: 'رجوع',
    btnFinish: 'إنهاء الإعداد',
    btnPlanting: 'جاري الزراعة...',
  }
};

const TONES = [
  { en: 'Friendly 😊', ar: 'ودّي 😊', value: 'Friendly' },
  { en: 'Professional 💼', ar: 'احترافي 💼', value: 'Professional' },
  { en: 'Funny 😄', ar: 'مرح 😄', value: 'Funny' },
  { en: 'Direct 🎯', ar: 'مباشر 🎯', value: 'Direct' },
  { en: 'Motivational 🔥', ar: 'تحفيزي 🔥', value: 'Motivational' },
];

const STYLES = [
  { en: 'Brief & concise ⚡', ar: 'مختصر ⚡', value: 'Brief' },
  { en: 'Balanced 📝', ar: 'متوازن 📝', value: 'Balanced' },
  { en: 'Detailed & thorough 📚', ar: 'مفصّل 📚', value: 'Detailed' },
];

export default function OnboardingPage() {
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const t = translations[lang];
  const [step, setStep] = useState(1);
  const [isCooking, setIsCooking] = useState(false);
  const [formData, setFormData] = useState({
    batata_name: '',
    avatar: '🥔',
    language: 'English',
    usage_purpose: '',
    nickname: '',
    preferred_tone: 'Friendly',
    response_style: 'Balanced',
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedLang = localStorage.getItem('batata_lang') as 'en' | 'ar';
    if (savedLang) {
      setLang(savedLang);
      if (savedLang === 'ar') {
        setFormData(prev => ({ ...prev, language: 'Arabic' }));
      }
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push('/login');
    };
    checkAuth();
  }, [router]);

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleSubmit = async () => {
    setIsCooking(true);
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      // 1. Save profile to Supabase
      const { error } = await supabase
        .schema('batata')
        .from('profiles')
        .update({
          ...formData,
          onboarding_completed: true
        })
        .eq('id', session.user.id);

      if (error) {
        console.error(error);
        setLoading(false);
        setIsCooking(false);
        return;
      }

      try {
        const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_INIT_URL;
        if (webhookUrl) {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: session.user.id,
              username: session.user.user_metadata?.username,
              batata_name: formData.batata_name,
              avatar: formData.avatar,
              language: formData.language,
              usage_purpose: formData.usage_purpose,
              nickname: formData.nickname,
              preferred_tone: formData.preferred_tone,
              response_style: formData.response_style
            })
          });

          if (response.ok) {
            const text = await response.text();
            const data = text ? JSON.parse(text) : null;
            
            if (data) {
              // Store questions for the chat page
              localStorage.setItem('batata_init_data', JSON.stringify(data));
            }

          }
        }
      } catch (err) {
        console.error('Webhook Error:', err);
      }

      // Redirect to chat now that everything is done
      router.push('/chat');
    }
  };

  if (isCooking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        gap: '30px'
      }}>
        <div style={{ position: 'relative' }}>
          {/* Frying Pan / Steam Animation */}
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              rotate: [0, 2, -2, 0]
            }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{ fontSize: '80px', filter: 'drop-shadow(0 0 20px rgba(245, 158, 11, 0.4))' }}
          >
            {formData.avatar}
          </motion.div>
          
          {/* Steam Bubbles */}
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], y: -50, x: (i - 2) * 20 }}
              transition={{ repeat: Infinity, duration: 2, delay: i * 0.6 }}
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                width: '10px',
                height: '10px',
                background: 'rgba(255,255,255,0.3)',
                borderRadius: '50%',
                filter: 'blur(2px)'
              }}
            />
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--primary)' }}>
            {lang === 'ar' ? 'جاري طهي البطاطا الخاصة بك...' : 'Cooking your Batata...'}
          </h2>
          <p style={{ color: '#a0a0a0' }}>
            {lang === 'ar' ? 'نحن نجهز المحادثة الأولى لك' : 'Preparing your first conversation'}
          </p>
        </div>
        
        <Loader2 className="animate-spin" size={24} color="var(--primary)" />
      </div>
    );
  }

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)'
    }}>
      <div className="glass" style={{
        width: '100%',
        maxWidth: '500px',
        padding: '40px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Progress Bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)' }}>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(step / 7) * 100}%` }}
            style={{ height: '100%', background: 'var(--primary)' }}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ x: lang === 'ar' ? -20 : 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: lang === 'ar' ? 20 : -20, opacity: 0 }}
            >
              <div style={{ marginBottom: '32px' }}>
                <Bot size={40} color="var(--primary)" style={{ marginBottom: '16px' }} />
                <h1 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '8px' }}>{t.step1Title}</h1>
                <p style={{ color: '#a0a0a0' }}>{t.step1Subtitle}</p>
              </div>
              <input
                type="text"
                placeholder={t.step1Placeholder}
                value={formData.batata_name}
                onChange={(e) => setFormData({...formData, batata_name: e.target.value})}
                autoFocus
              />
              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  className="btn-primary" 
                  onClick={nextStep}
                  disabled={!formData.batata_name}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {t.btnContinue} <ChevronRight size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ x: lang === 'ar' ? -20 : 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: lang === 'ar' ? 20 : -20, opacity: 0 }}
            >
              <div style={{ marginBottom: '32px' }}>
                <Sparkles size={40} color="var(--primary)" style={{ marginBottom: '16px' }} />
                <h1 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '8px' }}>{t.step2Title}</h1>
                <p style={{ color: '#a0a0a0' }}>{t.step2Subtitle}</p>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: '12px',
                marginBottom: '40px' 
              }}>
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setFormData({...formData, avatar: emoji})}
                    style={{
                      fontSize: '2rem',
                      padding: '20px',
                      background: formData.avatar === emoji ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: formData.avatar === emoji ? '2px solid var(--primary)' : '2px solid transparent',
                      borderRadius: '12px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn-secondary" onClick={prevStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ChevronLeft size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} /> {t.btnBack}
                </button>
                <button className="btn-primary" onClick={nextStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t.btnContinue} <ChevronRight size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ x: lang === 'ar' ? -20 : 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: lang === 'ar' ? 20 : -20, opacity: 0 }}
            >
              <div style={{ marginBottom: '32px' }}>
                <Languages size={40} color="var(--primary)" style={{ marginBottom: '16px' }} />
                <h1 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '8px' }}>{t.step3Title}</h1>
                <p style={{ color: '#a0a0a0' }}>{t.step3Subtitle}</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '40px' }}>
                {LANGUAGES.map(l => (
                  <button
                    key={l}
                    onClick={() => setFormData({...formData, language: l})}
                    style={{
                      padding: '10px 20px',
                      background: formData.language === l ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                      color: formData.language === l ? 'black' : 'white',
                      borderRadius: '30px',
                      border: 'none',
                      fontWeight: '600'
                    }}
                  >
                    {l === 'Arabic' && lang === 'ar' ? 'العربية' : l}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn-secondary" onClick={prevStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ChevronLeft size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} /> {t.btnBack}
                </button>
                <button className="btn-primary" onClick={nextStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t.btnContinue} <ChevronRight size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ x: lang === 'ar' ? -20 : 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: lang === 'ar' ? 20 : -20, opacity: 0 }}
            >
              <div style={{ marginBottom: '32px' }}>
                <Target size={40} color="var(--primary)" style={{ marginBottom: '16px' }} />
                <h1 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '8px' }}>{t.step4Title}</h1>
                <p style={{ color: '#a0a0a0' }}>{t.step4Subtitle}</p>
              </div>
              <textarea
                placeholder={t.step4Placeholder}
                value={formData.usage_purpose}
                onChange={(e) => setFormData({...formData, usage_purpose: e.target.value})}
                style={{
                  width: '100%', background: 'var(--secondary)', border: '1px solid var(--border)',
                  color: 'white', padding: '16px', borderRadius: '12px', minHeight: '120px',
                  fontSize: '1rem', outline: 'none', resize: 'none',
                  textAlign: lang === 'ar' ? 'right' : 'left'
                }}
              />
              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn-secondary" onClick={prevStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ChevronLeft size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} /> {t.btnBack}
                </button>
                <button className="btn-primary" onClick={nextStep} disabled={!formData.usage_purpose}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t.btnContinue} <ChevronRight size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 5 – Nickname */}
          {step === 5 && (
            <motion.div key="step5"
              initial={{ x: lang === 'ar' ? -20 : 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: lang === 'ar' ? 20 : -20, opacity: 0 }}
            >
              <div style={{ marginBottom: '32px' }}>
                <User size={40} color="var(--primary)" style={{ marginBottom: '16px' }} />
                <h1 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '8px' }}>{t.step5Title}</h1>
                <p style={{ color: '#a0a0a0' }}>{t.step5Subtitle}</p>
              </div>
              <input
                type="text"
                placeholder={t.step5Placeholder}
                value={formData.nickname}
                onChange={(e) => setFormData({...formData, nickname: e.target.value})}
                autoFocus
              />
              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn-secondary" onClick={prevStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ChevronLeft size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} /> {t.btnBack}
                </button>
                <button className="btn-primary" onClick={nextStep} disabled={!formData.nickname}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t.btnContinue} <ChevronRight size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 6 – Tone */}
          {step === 6 && (
            <motion.div key="step6"
              initial={{ x: lang === 'ar' ? -20 : 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: lang === 'ar' ? 20 : -20, opacity: 0 }}
            >
              <div style={{ marginBottom: '32px' }}>
                <MessageSquare size={40} color="var(--primary)" style={{ marginBottom: '16px' }} />
                <h1 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '8px' }}>{t.step6Title}</h1>
                <p style={{ color: '#a0a0a0' }}>{t.step6Subtitle}</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '40px' }}>
                {TONES.map(tone => (
                  <button key={tone.value}
                    onClick={() => setFormData({...formData, preferred_tone: tone.value})}
                    style={{
                      padding: '12px 20px', borderRadius: '30px', fontWeight: '600', fontSize: '0.95rem',
                      background: formData.preferred_tone === tone.value ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                      color: formData.preferred_tone === tone.value ? 'black' : 'white',
                      border: formData.preferred_tone === tone.value ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {lang === 'ar' ? tone.ar : tone.en}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn-secondary" onClick={prevStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ChevronLeft size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} /> {t.btnBack}
                </button>
                <button className="btn-primary" onClick={nextStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t.btnContinue} <ChevronRight size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 7 – Response Style */}
          {step === 7 && (
            <motion.div key="step7"
              initial={{ x: lang === 'ar' ? -20 : 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: lang === 'ar' ? 20 : -20, opacity: 0 }}
            >
              <div style={{ marginBottom: '32px' }}>
                <AlignLeft size={40} color="var(--primary)" style={{ marginBottom: '16px' }} />
                <h1 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '8px' }}>{t.step7Title}</h1>
                <p style={{ color: '#a0a0a0' }}>{t.step7Subtitle}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
                {STYLES.map(style => (
                  <button key={style.value}
                    onClick={() => setFormData({...formData, response_style: style.value})}
                    style={{
                      padding: '16px 20px', borderRadius: '12px', fontWeight: '600', fontSize: '1rem',
                      textAlign: lang === 'ar' ? 'right' : 'left',
                      background: formData.response_style === style.value ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                      color: formData.response_style === style.value ? 'var(--primary)' : 'white',
                      border: formData.response_style === style.value ? '2px solid var(--primary)' : '2px solid rgba(255,255,255,0.08)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {lang === 'ar' ? style.ar : style.en}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn-secondary" onClick={prevStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ChevronLeft size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} /> {t.btnBack}
                </button>
                <button className="btn-primary" onClick={handleSubmit} disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {loading ? t.btnPlanting : t.btnFinish} <Check size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
