'use client';

import { useEffect } from 'react';
import { useBrandStore }    from '@/store/useBrandStore';
import { usePostStore }     from '@/store/usePostStore';
import { useTemplateStore } from '@/store/useTemplateStore';
import { fetchSupabaseFbPages, correctLocalStorageBrandIds } from '@/lib/facebookPages';

/**
 * Rehydriert die persistierten Zustand-Stores erst NACH dem Mount.
 * Zusammen mit `skipHydration: true` in den Stores zeigen Server- und erster
 * Client-Render identisch die Default-Werte → kein Hydration-Mismatch (#418).
 *
 * Zusätzlich werden einmalig beim App-Start die (ggf. veralteten) brand_ids im
 * localStorage mit den autoritativen Supabase-Werten korrigiert.
 *
 * Rendert nichts.
 */
export default function StoreHydration() {
  useEffect(() => {
    const rehydrations = [
      useBrandStore.persist.rehydrate(),
      usePostStore.persist.rehydrate(),
      useTemplateStore.persist.rehydrate(),
    ];

    Promise.all(rehydrations).then(() => {
      // brand_ids im localStorage aktiv mit Supabase korrigieren (Gift entfernen).
      fetchSupabaseFbPages().then(supa => {
        correctLocalStorageBrandIds(supa, useBrandStore.getState().brands);
      });
    });
  }, []);

  return null;
}
