'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

export function useAuth() {
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [loading, setLoading]   = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) { setLoading(false); return; }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (mounted) {
        setProfile(data ?? null);
        setLoading(false);
      }
    };

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = () => supabase.auth.signOut();

  return { profile, loading, signOut };
}
