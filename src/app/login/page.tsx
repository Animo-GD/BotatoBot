'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, ArrowRight, Loader2, Globe } from 'lucide-react';

const translations = {
  en: {
    title: 'Welcome Back',
    subtitle: 'Enter your spud credentials',
    username: 'User Name',
    password: 'Password',
    login: 'Login',
    loggingIn: 'Digging in...',
    newHere: 'New here?',
    createAccount: 'Create an account',
    errorInvalid: 'Invalid User Name or Password.',
    errorFormat: 'Invalid User Name format.',
    placeholderUsername: 'CoolBatata123',
  },
  ar: {
    title: 'مرحباً بك مجدداً',
    subtitle: 'أدخل بيانات حبة البطاطس الخاصة بك',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    login: 'تسجيل الدخول',
    loggingIn: 'جاري الدخول...',
    newHere: 'جديد هنا؟',
    createAccount: 'إنشاء حساب جديد',
    errorInvalid: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    errorFormat: 'تنسيق اسم المستخدم غير صحيح.',
    placeholderUsername: 'بطاطا_كول',
  }
};

export default function LoginPage() {
  const [lang, setLang] = useState<'en' | 'ar'>('en');

  useEffect(() => {
    const savedLang = localStorage.getItem('batata_lang') as 'en' | 'ar';
    if (savedLang) setLang(savedLang);
  }, []);

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'ar' : 'en';
    setLang(newLang);
    localStorage.setItem('batata_lang', newLang);
  };

  const t = translations[lang];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const safeUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const email = `${safeUsername}@batatabotato.com`;

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      const msg = loginError.message.includes('Invalid login credentials')
        ? 'Invalid User Name or Password.'
        : loginError.message.includes('Email')
          ? 'Invalid User Name format.'
          : loginError.message;
      setError(msg);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Check if onboarding is completed
      const { data: profile } = await supabase
        .schema('batata')
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', data.user.id)
        .single();

      if (profile?.onboarding_completed) {
        router.push('/chat');
      } else {
        router.push('/onboarding');
      }
    }
  };

  if (loading) {
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        gap: '20px'
      }}>
        <Loader2 className="animate-spin" size={52} color="var(--primary)" />
        <p style={{ fontWeight: '600', color: '#a0a0a0', fontSize: '1.1rem' }}>{t.loggingIn}</p>
      </div>
    );
  }

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: 'radial-gradient(circle at center, #1a1a1a 0%, #0a0a0a 100%)'
    }}>
      {/* Language Switcher */}
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
        <button 
          onClick={toggleLang}
          className="glass"
          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
        >
          <Globe size={16} /> {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          borderRadius: '16px'
        }}>
          <Loader2 className="animate-spin" size={48} color="var(--primary)" />
          <p style={{ marginTop: '16px', fontWeight: '600' }}>{t.loggingIn}</p>
        </div>
      )}

      <div className="glass" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ 
            background: 'var(--primary)', 
            padding: '12px', 
            borderRadius: '12px',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)'
          }}>
            <Sparkles size={32} color="black" />
          </div>
        </div>
        
        <h1 style={{ fontSize: '2rem', marginBottom: '8px', fontWeight: '700' }}>{t.title}</h1>
        <p style={{ color: '#a0a0a0', marginBottom: '32px' }}>{t.subtitle}</p>

        <form onSubmit={handleLogin} style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="username">{t.username}</label>
            <input
              id="username"
              type="text"
              placeholder={t.placeholderUsername}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div style={{ marginBottom: '32px' }}>
            <label htmlFor="password">{t.password}</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{ 
              color: '#ff4d4d', 
              fontSize: '0.9rem', 
              marginBottom: '20px',
              padding: '10px',
              background: 'rgba(255, 77, 77, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 77, 77, 0.2)'
            }}>
              {error}
            </div>
          )}

          <button 
            className="btn-primary" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <>{t.login} <ArrowRight size={18} style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }} /></>}
          </button>
        </form>

        <p style={{ marginTop: '24px', color: '#a0a0a0', fontSize: '0.9rem' }}>
          {t.newHere} <Link href="/signup" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}>{t.createAccount}</Link>
        </p>
      </div>
    </div>
  );
}
