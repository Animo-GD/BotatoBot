'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check onboarding
        const { data: profile } = await supabase
          .schema('batata')
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', session.user.id)
          .single();

        if (profile?.onboarding_completed) {
          router.push('/chat');
        } else {
          router.push('/onboarding');
        }
      } else {
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      color: 'white',
      gap: '20px'
    }}>
      <Loader2 className="animate-spin" size={40} color="var(--primary)" />
      <div style={{ fontSize: '0.9rem', color: '#a0a0a0', textAlign: 'center' }}>
        <p>Loading BatataBotato...</p>
        <p dir="rtl">جاري تحميل بطاطا بوتاتو...</p>
      </div>
    </div>
  );
}
