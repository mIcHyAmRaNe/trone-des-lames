import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { AgendaEvent } from '../../lib/events';
import {
  dayNumber,
  daysInMonth,
  formatDuration,
  formatRange,
  formatRangeShort,
  monthLabel,
  monthShortLabel,
} from './dates';
import './agenda-chronicle.css';

type FilterKey = 'upcoming' | 'past' | 'all';
type When = 'past' | 'upcoming';
type State = 'past' | 'upcoming' | 'ongoing';

interface Props {
  events: AgendaEvent[];
  initialPeriod: string | null;
  /** Server day (YYYY-MM-DD); never read the clock during render. */
  today: string;
}

type Month = { key: string; days: number };

type Domain = {
  sorted: AgendaEvent[];
  months: Month[];
  monthIndex: Map<string, number>;
  todayKey: string;
  endKey: string;
};

type Placed = {
  event: AgendaEvent;
  left: number;
  right: number;
  lane: number;
  state: State;
  /** Month view: the ribbon is cut by a month edge. */
  clip: 'start' | 'end' | 'both' | null;
};

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MIN_SPAN = 12; // percent of the graph, keeps the minimum ribbon width from colliding
const NOSCRIPT_SUBMIT = '<button type="submit" class="scroll-btn">Afficher</button>';

const whenOf = (event: AgendaEvent, today: string): When =>
  event.endsOn < today ? 'past' : 'upcoming';

const isOngoing = (event: AgendaEvent, today: string) =>
  event.startsOn <= today && event.endsOn >= today;

/* ---- Full chronicle domain: whole months, always including today. ---- */
function buildDomain(events: AgendaEvent[], today: string): Domain {
  const sorted = [...events].sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id - b.id);
  const todayKey = today.slice(0, 7);
  const minStart = sorted.reduce((min, e) => (e.startsOn < min ? e.startsOn : min), today);
  const maxEnd = sorted.reduce((max, e) => (e.endsOn > max ? e.endsOn : max), today);
  const startKey = minStart.slice(0, 7);
  const endKey = maxEnd.slice(0, 7);

  const months: Month[] = [];
  let cursorYear = Number(startKey.slice(0, 4));
  let cursorMonth = Number(startKey.slice(5, 7));

  // At least three months so a single short event still reads as a chronicle.
  while (months.length < 3 || `${cursorYear}-${String(cursorMonth).padStart(2, '0')}` <= endKey) {
    months.push({
      key: `${cursorYear}-${String(cursorMonth).padStart(2, '0')}`,
      days: daysInMonth(cursorYear, cursorMonth),
    });
    cursorMonth += 1;
    if (cursorMonth > 12) {
      cursorMonth = 1;
      cursorYear += 1;
    }
    if (months.length >= 48) break; // shortcut: dates beyond 4 years clamp to the graph edge, upgrade if long-range events become common
  }

  return {
    sorted,
    months,
    monthIndex: new Map(months.map((m, i) => [m.key, i])),
    todayKey,
    endKey,
  };
}

function normalizePeriod(domain: Domain, raw: string | null | undefined): string | null {
  return raw && PERIOD_RE.test(raw) && domain.monthIndex.has(raw) ? raw : null;
}

function defaultFilterFor(domain: Domain, period: string | null, today: string): FilterKey {
  if (period) return 'all';
  return domain.sorted.some((e) => e.endsOn >= today) ? 'upcoming' : 'all';
}

function periodHref(period: string | null): string {
  return period ? `/agenda?periode=${period}#chronique` : '/agenda#chronique';
}

function matchesFilter(when: When, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  return filter === 'upcoming' ? when !== 'past' : when === 'past';
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---- Everything the chronicle draws for one period. ---- */
function computeView(domain: Domain, period: string | null, today: string) {
  const { sorted, months, monthIndex, todayKey, endKey } = domain;
  const isMonthView = period !== null;
  const viewMonth = period ? months[monthIndex.get(period) ?? 0] : null;
  const viewDays = viewMonth?.days ?? 0;
  const periodLabel = period ? monthLabel(period) : '';
  const monthStart = period ? `${period}-01` : '';
  const monthEnd = viewMonth ? `${period}-${String(viewMonth.days).padStart(2, '0')}` : '';

  // Month pages include events that overlap the month, even partially.
  const viewEvents = isMonthView
    ? sorted.filter((e) => e.startsOn <= monthEnd && e.endsOn >= monthStart)
    : sorted;

  const upcomingCount = viewEvents.filter((e) => e.endsOn >= today).length;
  const pastCount = viewEvents.length - upcomingCount;

  const pctStart = (iso: string) => {
    if (isMonthView) {
      const from = iso < monthStart ? monthStart : iso;
      return ((dayNumber(from) - 1) / viewDays) * 100;
    }
    const i = monthIndex.get(iso.slice(0, 7));
    if (i === undefined) return iso.slice(0, 7) > endKey ? 99.9 : 0;
    return ((i + (dayNumber(iso) - 1) / months[i].days) / months.length) * 100;
  };
  const pctEnd = (iso: string) => {
    if (isMonthView) {
      const to = iso > monthEnd ? monthEnd : iso;
      return (dayNumber(to) / viewDays) * 100;
    }
    const i = monthIndex.get(iso.slice(0, 7));
    if (i === undefined) return iso.slice(0, 7) > endKey ? 100 : 0;
    return ((i + dayNumber(iso) / months[i].days) / months.length) * 100;
  };

  /* ---- Lane packing. MIN_SPAN reserves room for the minimum ribbon width. ---- */
  const placed: Placed[] = viewEvents
    .map((event) => {
      const left = pctStart(event.startsOn);
      let right = Math.max(pctEnd(event.endsOn), left + MIN_SPAN);
      let from = left;
      if (right > 100) {
        right = 100;
        // Month pages must not create horizontal overflow: short tail ribbons grow to the left.
        if (isMonthView) from = Math.max(0, 100 - MIN_SPAN);
      }
      const clipStart = isMonthView && event.startsOn < monthStart;
      const clipEnd = isMonthView && event.endsOn > monthEnd;
      return {
        event,
        left: from,
        right,
        lane: 0,
        state: (isOngoing(event, today) ? 'ongoing' : whenOf(event, today)) as State,
        clip: clipStart && clipEnd ? 'both' : clipStart ? 'start' : clipEnd ? 'end' : null,
      };
    })
    .sort((a, b) => a.left - b.left || b.right - a.right);

  const laneEnds: number[] = [];
  for (const p of placed) {
    let lane = laneEnds.findIndex((end) => end + 0.4 <= p.left);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    p.lane = lane;
    laneEnds[lane] = p.right;
  }

  const laneCount = Math.max(1, laneEnds.length);
  // Height is capped: many simultaneous events compress the lanes instead of growing the graph.
  const laneHeight = Math.max(16, Math.min(58, Math.floor(300 / laneCount)));
  const ribbonHeight = Math.max(12, Math.min(44, laneHeight - 8));
  const graphHeight = laneCount * laneHeight + 2;
  const compact = laneHeight < 44;

  const todayMonthIndex = monthIndex.get(todayKey) ?? 0;
  const showToday = !isMonthView || todayKey === period;
  const todayPct = isMonthView
    ? ((dayNumber(today) - 0.5) / viewDays) * 100
    : ((todayMonthIndex + (dayNumber(today) - 0.5) / months[todayMonthIndex].days) / months.length) * 100;
  const todayFlagSide = todayPct > 86 ? 'left' : 'right';

  // Month pages get a day scale; the last day is rendered right-aligned next to the ticks.
  const dayTicks =
    isMonthView && viewDays > 0 ? [1, 5, 10, 15, 20, 25, 30].filter((d) => d <= viewDays) : [];

  const groups = isMonthView
    ? viewEvents.length > 0
      ? [{ key: period ?? '', label: periodLabel, items: viewEvents }]
      : []
    : [...new Set(sorted.map((e) => e.startsOn.slice(0, 7)))].map((key) => ({
        key,
        label: monthLabel(key),
        items: sorted.filter((e) => e.startsOn.slice(0, 7) === key),
      }));

  const selectedIndex = period ? months.findIndex((m) => m.key === period) : -1;
  const prevMonth = selectedIndex > 0 ? months[selectedIndex - 1] : null;
  const nextMonth =
    selectedIndex >= 0 && selectedIndex < months.length - 1 ? months[selectedIndex + 1] : null;

  return {
    months,
    isMonthView,
    viewDays,
    periodLabel,
    monthStart,
    monthEnd,
    viewEvents,
    upcomingCount,
    pastCount,
    placed,
    laneHeight,
    ribbonHeight,
    graphHeight,
    compact,
    showToday,
    todayPct,
    todayFlagSide,
    dayTicks,
    groups,
    prevMonth,
    nextMonth,
    emptyMonth: isMonthView && viewEvents.length === 0,
  };
}

export default function AgendaChronicle({ events, initialPeriod: periodProp, today }: Props) {
  const domain = useMemo(() => buildDomain(events, today), [events, today]);
  const initialPeriod = useMemo(() => normalizePeriod(domain, periodProp), [domain, periodProp]);

  const [period, setPeriod] = useState<string | null>(initialPeriod);
  const [filter, setFilter] = useState<FilterKey>(() =>
    defaultFilterFor(domain, initialPeriod, today),
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Re-selecting the same event must focus the plate again, even though selectedId is unchanged.
  const [focusTicket, setFocusTicket] = useState(0);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  // Start scrollable so the first client render matches the server output.
  const [scrollable, setScrollable] = useState(true);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const todayLineRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const current = useMemo(() => computeView(domain, period, today), [domain, period, today]);

  const selectEvent = (id: number) => {
    setSelectedId(id);
    setFocusTicket((n) => n + 1);
  };

  const changePeriod = useCallback(
    (next: string | null) => {
      const normalized = normalizePeriod(domain, next);
      setPeriod(normalized);
      setFilter(defaultFilterFor(domain, normalized, today));
      setSelectedId(null);
      window.history.pushState(null, '', periodHref(normalized));
    },
    [domain, today],
  );

  const onPeriodClick = (next: string | null) => (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    changePeriod(next);
  };

  const updateScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const max = scroller.scrollWidth - scroller.clientWidth;
    const isScrollable = max > 48;
    setCanLeft(isScrollable && scroller.scrollLeft > 2);
    setCanRight(isScrollable && scroller.scrollLeft < max - 2);
    setScrollable(isScrollable);
  }, []);

  const scrollToToday = useCallback((smooth = true) => {
    const scroller = scrollerRef.current;
    const line = todayLineRef.current;
    if (!scroller || !line) return;
    const left = line.offsetLeft - scroller.clientWidth * 0.18;
    scroller.scrollTo({
      left: Math.max(0, left),
      behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
    });
  }, []);

  // Back/forward: adopt the URL period in place, never push a new entry.
  useEffect(() => {
    const onPopState = () => {
      const raw = new URLSearchParams(window.location.search).get('periode');
      const next = normalizePeriod(domain, raw);
      setPeriod(next);
      setFilter(defaultFilterFor(domain, next, today));
      setSelectedId(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [domain, today]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    updateScroll();
    scroller.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll);
    // Web fonts settle the ribbon widths after hydration; re-measure once they are ready.
    void document.fonts?.ready.then(() => updateScroll());
    return () => {
      scroller.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, [updateScroll, period, current.emptyMonth]);

  useEffect(() => {
    updateScroll();
  }, [updateScroll, period, filter]);

  // A fresh full-chronicle view opens on today, as the reloaded page used to.
  useEffect(() => {
    if (!period && defaultFilterFor(domain, null, today) === 'upcoming') scrollToToday(false);
  }, [period, domain, today, scrollToToday]);

  // Focus the opened plate without moving the scroll, then bring it into view.
  useEffect(() => {
    if (selectedId === null) return;
    const detail = detailRef.current;
    if (!detail) return;
    detail.focus({ preventScroll: true });
    detail.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [selectedId, focusTicket]);

  const visibleCount = current.viewEvents.filter((e) =>
    matchesFilter(whenOf(e, today), filter),
  ).length;

  const filters: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'upcoming', label: 'À venir', count: current.upcomingCount },
    { key: 'past', label: 'Passées', count: current.pastCount },
    { key: 'all', label: 'Toutes', count: current.viewEvents.length },
  ];

  const handlePeriodSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    changePeriod(event.target.value || null);
  };

  return (
    <section
      id="chronique"
      aria-labelledby="chronique-titre"
      className="scroll-mt-24"
      data-agenda=""
      data-default-filter={defaultFilterFor(domain, period, today)}
      data-today-date={today}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="label-caps">Chronique du royaume</p>
          <h2
            id="chronique-titre"
            className="mt-2 font-display text-2xl tracking-[0.05em] text-parchment sm:text-3xl"
          >
            Le fil des animations
          </h2>
        </div>

        {current.viewEvents.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="hidden text-[0.625rem] uppercase tracking-[0.18em] text-parchment-dim/70 sm:inline">
              Vue
            </span>
            <div
              className="flex border border-gold/25 bg-ink/40 p-0.5"
              role="group"
              aria-label="Filtrer les animations par date"
            >
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  data-filter={f.key}
                  aria-pressed={filter === f.key}
                  className="filter-btn"
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  <span className="tabular-nums opacity-60">{f.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rule-gold mt-5 w-full opacity-70"></div>

      {domain.sorted.length === 0 ? (
        <div className="card-dark texture-noise mt-6 flex flex-col items-center px-6 py-14 text-center">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8 text-gold/60"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2l2.4 6.2L21 10l-5 4.6L17.2 21 12 17.6 6.8 21 8 14.6 3 10l6.6-1.8L12 2z" />
          </svg>
          <p className="mt-4 font-display text-lg tracking-[0.06em] text-parchment">
            Le registre est encore vide
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-parchment-dim">
            Aucune animation n’est inscrite pour le moment. Les premières propositions
            apparaîtront ici après validation par l’organisation.
          </p>
          <a href="#proposer" className="btn-ghost mt-6">
            Proposer une animation
          </a>
        </div>
      ) : (
        <>
          {/* Desktop: horizontal chronicle. Phones get the month list below. */}
          <div className="chronicle card-dark texture-noise relative mt-6 hidden md:block">
            <span className="corner corner-tl" aria-hidden="true"></span>
            <span className="corner corner-tr" aria-hidden="true"></span>
            <span className="corner corner-bl" aria-hidden="true"></span>
            <span className="corner corner-br" aria-hidden="true"></span>

            {current.isMonthView && (
              <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-gold/20 bg-ink-3/70 px-4 py-2.5">
                <p className="flex items-center gap-2 font-display text-xs uppercase tracking-[0.18em] text-gold-light">
                  <span className="h-1.5 w-1.5 rotate-45 bg-gold" aria-hidden="true"></span>
                  {current.periodLabel}
                </p>
                <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.5625rem] uppercase tracking-[0.16em] text-parchment-dim/70">
                  <span>
                    {current.viewEvents.length} animation
                    {current.viewEvents.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-gold/40" aria-hidden="true">
                    ◆
                  </span>
                  <span>{current.viewDays} jours</span>
                  <span className="text-gold/40" aria-hidden="true">
                    ◆
                  </span>
                  <a
                    href={periodHref(null)}
                    onClick={onPeriodClick(null)}
                    className="text-gold-light underline decoration-gold/40 underline-offset-4 transition-colors hover:decoration-gold"
                  >
                    Toute la chronique
                  </a>
                </p>
              </div>
            )}

            {current.emptyMonth ? (
              <div className="px-6 py-12 text-center">
                <p className="font-display text-lg tracking-[0.04em] text-parchment">
                  Aucune animation en {current.periodLabel}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-parchment-dim">
                  Ce mois ne contient aucune animation au registre.
                </p>
                <a href={periodHref(null)} onClick={onPeriodClick(null)} className="btn-ghost mt-6">
                  Voir toute la chronique
                </a>
              </div>
            ) : (
              <div
                className="relative"
                data-scroll-frame=""
                data-can-left={canLeft ? '' : undefined}
                data-can-right={canRight ? '' : undefined}
              >
                <div
                  className={`chronicle-scroll relative ${
                    current.isMonthView
                      ? 'overflow-hidden'
                      : 'overflow-x-auto overflow-y-hidden'
                  }`}
                  data-scroll=""
                  ref={scrollerRef}
                  tabIndex={current.isMonthView ? undefined : 0}
                  role={current.isMonthView ? undefined : 'region'}
                  aria-label={
                    current.isMonthView
                      ? undefined
                      : 'Chronique des animations, défilement horizontal'
                  }
                >
                  <div
                    className="chronicle-inner relative"
                    style={{
                      width: current.isMonthView
                        ? '100%'
                        : `max(100%, ${current.months.length * 132}px)`,
                    }}
                  >
                    {/* Ruler: months for the full chronicle, days for a month page. */}
                    <div
                      className="ruler relative flex h-12 border-b border-gold/25 bg-ink-2/80"
                      aria-hidden="true"
                    >
                      {current.isMonthView ? (
                        <>
                          {current.dayTicks.map((d) => (
                            <span
                              key={d}
                              className="day-tick"
                              style={{ left: `${((d - 1) / current.viewDays) * 100}%` }}
                            >
                              {d}
                            </span>
                          ))}
                          {current.viewDays % 5 !== 0 && (
                            <span className="day-tick day-tick-last" style={{ left: '100%' }}>
                              {current.viewDays}
                            </span>
                          )}
                        </>
                      ) : (
                        current.months.map((m) => (
                          <div
                            key={m.key}
                            className="relative flex flex-1 items-center border-l border-gold/10 pl-3 first:border-l-0"
                          >
                            <span className="ruler-label">{monthShortLabel(m.key)}</span>
                          </div>
                        ))
                      )}

                      {current.showToday && (
                        <div
                          className="today-flag"
                          data-side={current.todayFlagSide}
                          style={{ left: `${current.todayPct}%` }}
                        >
                          <span className="today-flag-dot"></span>
                          Aujourd’hui
                        </div>
                      )}
                    </div>

                    {/* Lanes */}
                    <div
                      className="lanes relative"
                      style={
                        {
                          '--lane-h': `${current.laneHeight}px`,
                          height: `${current.graphHeight}px`,
                        } as CSSProperties
                      }
                      aria-hidden="true"
                    >
                      {current.isMonthView ? (
                        <div className="absolute inset-0">
                          {current.dayTicks
                            .filter((d) => d !== 1)
                            .map((d) => (
                              <span
                                key={d}
                                className="day-grid"
                                style={{ left: `${((d - 1) / current.viewDays) * 100}%` }}
                              ></span>
                            ))}
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex">
                          {current.months.map((m) => (
                            <div
                              key={m.key}
                              className="month-cell relative flex-1 border-l border-gold/10 first:border-l-0"
                            ></div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ribbons sit above the lane grid, positioned in percent of the whole chronicle. */}
                    <div
                      className="absolute inset-x-0 top-12"
                      style={{ height: `${current.graphHeight}px` }}
                    >
                      {current.showToday && (
                        <div
                          className="today-line"
                          style={{ left: `${current.todayPct}%` }}
                          aria-hidden="true"
                          ref={todayLineRef}
                        ></div>
                      )}

                      {current.placed.map((p) => (
                        <button
                          key={p.event.id}
                          type="button"
                          className={`ribbon${
                            matchesFilter(whenOf(p.event, today), filter) ? '' : ' is-off'
                          }`}
                          data-event={p.event.id}
                          data-when-item="true"
                          data-when={whenOf(p.event, today)}
                          data-state={p.state}
                          data-clip={p.clip ?? undefined}
                          data-compact={current.compact ? 'true' : 'false'}
                          aria-pressed={selectedId === p.event.id}
                          aria-controls="agenda-detail"
                          title={`${p.event.title} — ${formatRange(p.event.startsOn, p.event.endsOn)}`}
                          style={{
                            left: `${p.left}%`,
                            width: `${Math.max(0.4, Math.min(p.right, 100) - p.left)}%`,
                            top: `${
                              p.lane * current.laneHeight +
                              (current.laneHeight - current.ribbonHeight) / 2
                            }px`,
                            height: `${current.ribbonHeight}px`,
                          }}
                          onClick={() => selectEvent(p.event.id)}
                        >
                          {p.state === 'ongoing' && (
                            <span className="ribbon-pulse" aria-hidden="true"></span>
                          )}
                          {p.state === 'ongoing' && <span className="sr-only">En cours. </span>}
                          <span className="ribbon-body">
                            <span className="ribbon-title">{p.event.title}</span>
                            {!current.compact && (
                              <span className="ribbon-sub">
                                {formatRangeShort(p.event.startsOn, p.event.endsOn)}
                              </span>
                            )}
                          </span>
                          <span className="sr-only">
                            , du {formatRange(p.event.startsOn, p.event.endsOn)}, {p.event.city}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {!current.isMonthView && (
                  <>
                    <div className="scroll-fade scroll-fade-left" aria-hidden="true"></div>
                    <div className="scroll-fade scroll-fade-right" aria-hidden="true"></div>
                  </>
                )}
              </div>
            )}

            {current.viewEvents.length > 0 && (
              <p
                data-filter-empty=""
                hidden={visibleCount > 0}
                className="border-t border-gold/20 bg-ink/40 px-4 py-3 text-center text-sm text-parchment-dim"
              >
                Aucune animation dans cette vue. Essayez « Toutes ».
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-gold/20 px-3 py-2.5 sm:px-4">
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.5625rem] uppercase tracking-[0.16em] text-parchment-dim">
                <li className="flex items-center gap-1.5">
                  <span className="h-1.5 w-3.5 bg-gold/80"></span>À venir
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1.5 w-3.5 bg-gold/80"></span>
                  <span className="-ml-1.5 mr-0.5 h-1.5 w-1.5 rounded-full bg-blood"></span>
                  En cours
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1.5 w-3.5 bg-parchment-dim/30"></span>Passées
                </li>
                {current.showToday && (
                  <li className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-px border-l border-dashed border-gold-light/70"></span>
                    Aujourd’hui
                  </li>
                )}
              </ul>

              <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
                {!current.isMonthView && (
                  <p
                    data-scroll-hint=""
                    className="hidden text-[0.5625rem] uppercase tracking-[0.16em] text-parchment-dim/60 lg:block"
                    style={{ display: scrollable ? undefined : 'none' }}
                  >
                    Faites défiler la chronique
                  </p>
                )}

                <div
                  className="period-nav"
                  role="group"
                  aria-label="Filtrer la chronique par période"
                >
                  <label htmlFor="agenda-month" className="period-label">
                    Période affichée
                  </label>

                  {current.prevMonth ? (
                    <a
                      className="scroll-btn"
                      href={periodHref(current.prevMonth.key)}
                      aria-label={`Mois précédent, ${monthLabel(current.prevMonth.key)}`}
                      onClick={onPeriodClick(current.prevMonth.key)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M15 5l-7 7 7 7" />
                      </svg>
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="scroll-btn"
                      disabled
                      aria-label="Mois précédent"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M15 5l-7 7 7 7" />
                      </svg>
                    </button>
                  )}

                  <form
                    method="get"
                    action="/agenda#chronique"
                    className="period-form"
                    onSubmit={(event) => event.preventDefault()}
                  >
                    <div className="period-field">
                      <select
                        id="agenda-month"
                        name="periode"
                        data-period-select=""
                        className="period-select"
                        value={period ?? ''}
                        onChange={handlePeriodSelect}
                      >
                        <option value="">Toute la chronique</option>
                        {current.months.map((m) => (
                          <option key={m.key} value={m.key}>
                            {monthLabel(m.key)}
                          </option>
                        ))}
                      </select>
                      <svg
                        viewBox="0 0 24 24"
                        className="period-chevron"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                    <noscript
                      suppressHydrationWarning
                      dangerouslySetInnerHTML={{ __html: NOSCRIPT_SUBMIT }}
                    />
                  </form>

                  {current.nextMonth ? (
                    <a
                      className="scroll-btn"
                      href={periodHref(current.nextMonth.key)}
                      aria-label={`Mois suivant, ${monthLabel(current.nextMonth.key)}`}
                      onClick={onPeriodClick(current.nextMonth.key)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="scroll-btn"
                      disabled
                      aria-label="Mois suivant"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}

                  {current.isMonthView ? (
                    <a
                      className="scroll-btn period-today"
                      href={periodHref(domain.todayKey)}
                      onClick={onPeriodClick(domain.todayKey)}
                    >
                      Aujourd’hui
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="scroll-btn period-today"
                      data-today=""
                      onClick={() => scrollToToday(true)}
                    >
                      Aujourd’hui
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Phone: vertical chronicle grouped by month. */}
          <div className="card-dark texture-noise mt-6 md:hidden">
            <div className="flex items-center justify-between gap-3 border-b border-gold/25 px-4 py-2.5">
              <p className="label-caps">Registre</p>
              <form
                method="get"
                action="/agenda#chronique"
                className="period-form"
                onSubmit={(event) => event.preventDefault()}
              >
                <label htmlFor="agenda-month-mobile" className="sr-only">
                  Période affichée
                </label>
                <div className="period-field">
                  <select
                    id="agenda-month-mobile"
                    name="periode"
                    data-period-select=""
                    className="period-select period-select-sm"
                    value={period ?? ''}
                    onChange={handlePeriodSelect}
                  >
                    <option value="">Toute la chronique</option>
                    {current.months.map((m) => (
                      <option key={m.key} value={m.key}>
                        {monthLabel(m.key)}
                      </option>
                    ))}
                  </select>
                  <svg
                    viewBox="0 0 24 24"
                    className="period-chevron"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
                <noscript
                  suppressHydrationWarning
                  dangerouslySetInnerHTML={{ __html: NOSCRIPT_SUBMIT }}
                />
              </form>
            </div>

            {current.emptyMonth ? (
              <div className="px-4 py-10 text-center">
                <p className="font-display text-sm tracking-[0.04em] text-parchment">
                  Aucune animation en {current.periodLabel}
                </p>
                <a
                  href={periodHref(null)}
                  onClick={onPeriodClick(null)}
                  className="mt-4 inline-block text-[0.625rem] uppercase tracking-[0.16em] text-gold-light underline decoration-gold/40 underline-offset-4"
                >
                  Voir toute la chronique
                </a>
              </div>
            ) : (
              <>
                <p
                  data-filter-empty=""
                  hidden={visibleCount > 0}
                  className="border-b border-gold/20 px-4 py-4 text-sm text-parchment-dim"
                >
                  Aucune animation dans cette vue.
                </p>

                {current.groups.map((g) => {
                  const groupVisible = g.items.some((e) =>
                    matchesFilter(whenOf(e, today), filter),
                  );
                  return (
                    <section
                      key={g.key}
                      data-group=""
                      className={`border-b border-gold/15 last:border-0${
                        groupVisible ? '' : ' is-off'
                      }`}
                    >
                      <h3 className="flex items-center gap-2.5 bg-ink-2/70 px-4 py-2.5 font-display text-xs tracking-[0.2em] text-gold">
                        <span className="h-1.5 w-1.5 rotate-45 bg-gold/80" aria-hidden="true"></span>
                        {g.label}
                      </h3>
                      <ul>
                        {g.items.map((e) => {
                          const clipStart =
                            current.isMonthView && e.startsOn < current.monthStart;
                          const clipEnd = current.isMonthView && e.endsOn > current.monthEnd;
                          const endLabel = clipEnd
                            ? 'suite'
                            : e.startsOn === e.endsOn
                              ? '1 j'
                              : current.isMonthView ||
                                  e.startsOn.slice(0, 7) === e.endsOn.slice(0, 7)
                                ? `→ ${dayNumber(e.endsOn)}`
                                : `→ ${monthShortLabel(e.endsOn.slice(0, 7)).split(' ')[0]}`;
                          return (
                            <li
                              key={e.id}
                              data-when-item="true"
                              data-when={whenOf(e, today)}
                              className={`border-t border-gold/10 first:border-t-0${
                                matchesFilter(whenOf(e, today), filter) ? '' : ' is-off'
                              }`}
                            >
                              <button
                                type="button"
                                className="list-item"
                                data-event={e.id}
                                data-state={isOngoing(e, today) ? 'ongoing' : whenOf(e, today)}
                                aria-pressed={selectedId === e.id}
                                aria-controls="agenda-detail"
                                onClick={() => selectEvent(e.id)}
                              >
                                <span className="list-date" aria-hidden="true">
                                  {clipStart ? (
                                    <span className="list-date-word">dès</span>
                                  ) : (
                                    <span className="list-date-day">{dayNumber(e.startsOn)}</span>
                                  )}
                                  <span className="list-date-end">{endLabel}</span>
                                </span>

                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2">
                                    <span className="truncate font-display text-sm tracking-[0.03em] text-parchment">
                                      {e.title}
                                    </span>
                                    {isOngoing(e, today) && (
                                      <>
                                        <span
                                          className="h-1.5 w-1.5 flex-none rounded-full bg-blood"
                                          aria-hidden="true"
                                        ></span>
                                        <span className="sr-only">En cours.</span>
                                      </>
                                    )}
                                  </span>
                                  <span className="mt-1 block text-xs text-parchment-dim">
                                    {e.city} · {e.county}
                                  </span>
                                  {current.isMonthView && (
                                    <span className="mt-1 block text-[0.625rem] tracking-[0.03em] text-gold/80">
                                      {formatRange(e.startsOn, e.endsOn)}
                                    </span>
                                  )}
                                  <span className="mt-1 block text-[0.625rem] uppercase tracking-[0.14em] text-gold/70">
                                    {e.rkName}
                                  </span>
                                  {!current.isMonthView && (
                                    <span className="sr-only">
                                      {formatRange(e.startsOn, e.endsOn)}
                                    </span>
                                  )}
                                </span>

                                <svg
                                  viewBox="0 0 24 24"
                                  className="mt-1 h-4 w-4 flex-none text-gold/50"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  aria-hidden="true"
                                >
                                  <path d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </>
            )}

            <div className="flex items-center justify-between border-t border-gold/20 px-4 py-3">
              <span className="text-[0.5625rem] uppercase tracking-[0.16em] text-parchment-dim/60">
                {current.viewEvents.length} animation
                {current.viewEvents.length > 1 ? 's' : ''}
                {current.isMonthView ? ' ce mois-ci' : ' au registre'}
              </span>
              {current.showToday && (
                <span className="flex items-center gap-1.5 text-[0.5625rem] uppercase tracking-[0.16em] text-parchment-dim/60">
                  <span className="inline-block h-3 w-px border-l border-dashed border-gold-light/70"></span>
                  Aujourd’hui
                </span>
              )}
            </div>
          </div>

          {/* Shared detail plate: opened by ribbons and list rows. */}
          <div
            id="agenda-detail"
            className="detail-shell card-dark texture-noise relative mt-5"
            tabIndex={-1}
            role="region"
            aria-live="polite"
            aria-label="Détail de l’animation"
            ref={detailRef}
          >
            <span className="detail-top-rule" aria-hidden="true"></span>

            <div data-detail-empty="" hidden={selectedId !== null} className="px-6 py-10 text-center">
              <div className="mb-4 flex items-center justify-center gap-2.5" aria-hidden="true">
                <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold/50"></span>
                <span className="h-1.5 w-1.5 rotate-45 border border-gold/60"></span>
                <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold/50"></span>
              </div>
              <p className="font-display text-lg tracking-[0.06em] text-parchment">
                Le détail d’une animation
              </p>
              <div className="rule-gold mx-auto my-4 w-16"></div>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-parchment-dim">
                Choisissez une animation dans la chronique pour lire ses dates, son organisateur et
                le lien vers le forum.
              </p>
              <p className="mt-4 text-[0.5625rem] uppercase tracking-[0.18em] text-parchment-dim/50">
                Tab pour parcourir · Entrée pour ouvrir
              </p>
            </div>

            {current.viewEvents.map((e) => (
              <div
                key={e.id}
                data-detail={e.id}
                hidden={selectedId !== e.id}
                className="relative px-5 py-6 sm:px-7 sm:py-7"
              >
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="min-w-0">
                    <p className="label-caps">
                      {isOngoing(e, today)
                        ? 'En cours'
                        : whenOf(e, today) === 'past'
                          ? 'Animation passée'
                          : 'Animation à venir'}
                    </p>
                    <h3 className="mt-2 font-display text-xl leading-snug tracking-[0.04em] text-parchment sm:text-2xl">
                      {e.title}
                    </h3>
                    <p className="mt-2 font-display text-sm tracking-[0.1em] text-gold-light">
                      {formatRange(e.startsOn, e.endsOn)}
                    </p>

                    <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-gold/15 pt-5 sm:grid-cols-4">
                      <div>
                        <dt className="detail-key">Ville</dt>
                        <dd className="detail-val">{e.city}</dd>
                      </div>
                      <div>
                        <dt className="detail-key">Comté</dt>
                        <dd className="detail-val">{e.county}</dd>
                      </div>
                      <div>
                        <dt className="detail-key">Proposé par</dt>
                        <dd className="detail-val">{e.rkName}</dd>
                      </div>
                      <div>
                        <dt className="detail-key">Durée</dt>
                        <dd className="detail-val">
                          {formatDuration(e.startsOn, e.endsOn)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex flex-col items-start gap-2 lg:items-end lg:pl-4">
                    <a
                      href={e.forumUrl}
                      target="_blank"
                      rel="noopener"
                      className="btn-gold w-full justify-center sm:w-auto"
                    >
                      Voir l’événement sur le forum
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M7 17L17 7M9 7h8v8" />
                      </svg>
                    </a>
                    <p className="text-[0.625rem] leading-relaxed text-parchment-dim/60 lg:text-right">
                      Forum officiel, nouvel onglet
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
