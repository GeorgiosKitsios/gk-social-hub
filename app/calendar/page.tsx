'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePostStore }  from '@/store/usePostStore';
import { useBrandStore } from '@/store/useBrandStore';
import { Post } from '@/lib/types';
import CalendarPostChip from '@/components/calendar/CalendarPostChip';
import {
  getMonthGrid,
  getWeekDays,
  formatMonthLabel,
  formatWeekLabel,
  isSameDay,
  WEEKDAY_LABELS,
  CalDay,
} from '@/components/calendar/calendarUtils';

type CalView = 'month' | 'week';

function newPostUrl(date: Date): string {
  return `/posts/new?date=${date.toISOString().slice(0, 10)}`;
}

interface CellProps {
  day:        CalDay;
  posts:      Post[];
  brandColor: string;
  onClick:    () => void;
}

function MonthCell({ day, posts, brandColor, onClick }: CellProps) {
  const visible  = posts.slice(0, 3);
  const overflow = posts.length - 3;

  return (
    <div
      className={`min-h-[90px] p-1.5 bg-neutral-900 flex flex-col gap-1 cursor-pointer group transition-colors hover:bg-neutral-800/80 ${
        !day.isCurrentMonth ? 'opacity-30' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium ${
          day.isToday ? 'bg-blue-600 text-white' : 'text-neutral-400 group-hover:text-white'
        }`}>
          {day.date.getDate()}
        </span>
        {posts.length > 0 && (
          <span className="text-xs text-neutral-600">{posts.length}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
        {visible.map(p => (
          <CalendarPostChip key={p.id} post={p} brandColor={brandColor} compact />
        ))}
        {overflow > 0 && (
          <span className="text-xs text-neutral-500 px-1">+{overflow} weitere</span>
        )}
      </div>
    </div>
  );
}

function WeekCell({ day, posts, brandColor, onClick }: CellProps) {
  return (
    <div
      className={`min-h-[200px] rounded-xl border flex flex-col cursor-pointer transition-colors ${
        day.isToday
          ? 'border-blue-500 bg-blue-500/5'
          : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
      }`}
      onClick={onClick}
    >
      <div className="px-3 py-2 border-b border-neutral-800 shrink-0">
        <span className={`text-sm font-medium ${day.isToday ? 'text-blue-400' : 'text-neutral-300'}`}>
          {day.date.getDate()}
        </span>
        {posts.length > 0 && (
          <span className="ml-2 text-xs text-neutral-600">{posts.length} Posts</span>
        )}
      </div>
      <div
        className="flex flex-col gap-1.5 p-2 flex-1 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {posts.map(p => (
          <CalendarPostChip key={p.id} post={p} brandColor={brandColor} />
        ))}
      </div>
      {posts.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-neutral-700">+</span>
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const { posts }                      = usePostStore();
  const { activeBrandId, activeBrand } = useBrandStore();

  const brand      = activeBrand();
  const brandColor = brand?.color ?? '#378ADD';
  const today      = new Date();

  const [view,       setView]       = useState<CalView>('month');
  const [year,       setYear]       = useState(today.getFullYear());
  const [month,      setMonth]      = useState(today.getMonth());
  const [weekAnchor, setWeekAnchor] = useState(today);

  const scheduledPosts = useMemo(() =>
    posts.filter(p =>
      p.brandId === activeBrandId &&
      (p.scheduledAt || p.publishedAt)
    ),
  [posts, activeBrandId]);

  function postsOnDay(date: Date): Post[] {
    return scheduledPosts
      .filter(p => isSameDay(new Date(p.scheduledAt ?? p.publishedAt!), date))
      .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }
  function prevWeek() {
    setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextWeek() {
    setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }
  function goToday() {
    const n = new Date();
    setYear(n.getFullYear()); setMonth(n.getMonth()); setWeekAnchor(n);
  }

  const monthGrid = useMemo(() => getMonthGrid(year, month),  [year, month]);
  const weekDays  = useMemo(() => getWeekDays(weekAnchor),    [weekAnchor]);

  return (
    <div className="flex flex-col h-full">

      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Kalender</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {brand?.name ?? '–'} · {view === 'month' ? formatMonthLabel(year, month) : formatWeekLabel(weekAnchor)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-neutral-800 p-1 rounded-lg">
            {(['month', 'week'] as CalView[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  view === v ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {v === 'month' ? 'Monat' : 'Woche'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={view === 'month' ? prevMonth : prevWeek}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors text-sm"
            >
              ‹
            </button>
            <button
              onClick={goToday}
              className="px-3 h-8 text-xs rounded-md border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
            >
              Heute
            </button>
            <button
              onClick={view === 'month' ? nextMonth : nextWeek}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors text-sm"
            >
              ›
            </button>
          </div>
          <button
            onClick={() => router.push('/posts/new')}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Post
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_LABELS.map(d => (
            <div key={d} className="text-center text-xs text-neutral-500 font-medium py-1">{d}</div>
          ))}
        </div>

        {view === 'month' && (
          <div className="grid grid-cols-7 gap-px bg-neutral-800 rounded-xl overflow-hidden border border-neutral-800">
            {monthGrid.map((day, i) => (
              <MonthCell
                key={i}
                day={day}
                posts={postsOnDay(day.date)}
                brandColor={brandColor}
                onClick={() => router.push(newPostUrl(day.date))}
              />
            ))}
          </div>
        )}

        {view === 'week' && (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, i) => (
              <WeekCell
                key={i}
                day={day}
                posts={postsOnDay(day.date)}
                brandColor={brandColor}
                onClick={() => router.push(newPostUrl(day.date))}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-neutral-800 shrink-0 flex gap-4 flex-wrap">
        {[
          { label: 'Entwurf',  cls: 'bg-neutral-700'  },
          { label: 'Geplant',  cls: 'bg-blue-600/80'  },
          { label: 'Gepostet', cls: 'bg-green-700/80' },
          { label: 'Fehler',   cls: 'bg-red-700/80'   },
        ].map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
