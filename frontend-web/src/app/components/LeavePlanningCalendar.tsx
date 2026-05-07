import { useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { addDays, addMonths, endOfMonth, format, isWeekend, startOfDay, startOfMonth } from 'date-fns';
import { AlertCircle, CalendarDays, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Calendar } from './ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface LeavePlanningCalendarProps {
  employeeId: string;
  department: string | null;
  startDate: string;
  endDate: string;
  onRangeChange: (startDate: string, endDate: string) => void;
}

interface PublicHolidayRow {
  id: string;
  name: string;
  date: string;
}

interface BlackoutPeriodRow {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  department: string | null;
  severity: 'soft' | 'hard';
}

interface LeaveRecordRow {
  id: string;
  start_date: string;
  end_date: string | null;
  days_requested: number;
  final_decision: 'APPROVED' | 'DENIED' | 'REFER_HR' | 'PENDING_INFO' | null;
  decision: {
    decision?: 'APPROVED' | 'DENIED' | 'REFER_HR' | 'PENDING_INFO';
  } | null;
}

type DaySignalType = 'hard' | 'soft' | 'holiday' | 'reserved';

interface DaySignal {
  type: DaySignalType;
  title: string;
  description?: string | null;
}

const WINDOW_MONTHS_AHEAD = 12;
const RECOMMENDATION_LOOKAHEAD_DAYS = 120;
const MAX_RECOMMENDED_DAYS = 90;

const parseDateOnly = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

const forEachDateInRange = (start: Date, end: Date, cb: (date: Date) => void) => {
  const cursor = startOfDay(start);
  const endOfRange = startOfDay(end);

  while (cursor <= endOfRange) {
    cb(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
};

const getDecisionStatus = (record: LeaveRecordRow) =>
  record.final_decision ?? record.decision?.decision ?? 'PENDING_INFO';

const severityStyles: Record<DaySignalType, string> = {
  hard: 'bg-red-100 text-red-800 border border-red-200',
  soft: 'bg-amber-100 text-amber-900 border border-amber-200',
  holiday: 'bg-blue-100 text-blue-800 border border-blue-200',
  reserved: 'bg-zinc-200 text-zinc-800 border border-zinc-300',
};

const severityLabels: Record<DaySignalType, string> = {
  hard: 'Hard blackout',
  soft: 'Soft blackout',
  holiday: 'Public holiday',
  reserved: 'Your pending/approved leave',
};

export function LeavePlanningCalendar({
  employeeId,
  department,
  startDate,
  endDate,
  onRangeChange,
}: LeavePlanningCalendarProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hardBlockedDates, setHardBlockedDates] = useState<Date[]>([]);
  const [softBlockedDates, setSoftBlockedDates] = useState<Date[]>([]);
  const [holidayDates, setHolidayDates] = useState<Date[]>([]);
  const [reservedDates, setReservedDates] = useState<Date[]>([]);
  const [recommendedDates, setRecommendedDates] = useState<Date[]>([]);
  const [signalsByDate, setSignalsByDate] = useState<Record<string, DaySignal[]>>({});
  const [activeDate, setActiveDate] = useState<string | null>(startDate || null);

  useEffect(() => {
    setActiveDate(startDate || null);
  }, [startDate]);

  useEffect(() => {
    let isMounted = true;

    const loadCalendarSignals = async () => {
      setIsLoading(true);
      setLoadError(null);

      const today = startOfDay(new Date());
      const windowStart = startOfMonth(today);
      const windowEnd = endOfMonth(addMonths(today, WINDOW_MONTHS_AHEAD));
      const windowStartKey = toDateKey(windowStart);
      const windowEndKey = toDateKey(windowEnd);

      const holidaysPromise = supabase
        .from('public_holidays')
        .select('id, name, date')
        .gte('date', windowStartKey)
        .lte('date', windowEndKey)
        .order('date', { ascending: true });

      let blackoutQuery = supabase
        .from('blackout_periods')
        .select('id, title, description, start_date, end_date, department, severity')
        .gte('end_date', windowStartKey)
        .lte('start_date', windowEndKey)
        .order('start_date', { ascending: true });

      if (department?.trim()) {
        blackoutQuery = blackoutQuery.in('department', ['ALL', department.trim()]);
      } else {
        blackoutQuery = blackoutQuery.eq('department', 'ALL');
      }

      const leavePromise = supabase
        .from('leave_records')
        .select('id, start_date, end_date, days_requested, final_decision, decision')
        .eq('employee_id', employeeId)
        .gte('start_date', windowStartKey)
        .lte('start_date', windowEndKey)
        .order('start_date', { ascending: true });

      const [holidaysRes, blackoutRes, leaveRes] = await Promise.all([
        holidaysPromise,
        blackoutQuery,
        leavePromise,
      ]);

      if (!isMounted) return;

      if (holidaysRes.error || blackoutRes.error || leaveRes.error) {
        setLoadError('Could not load leave planning dates right now.');
        setIsLoading(false);
        return;
      }

      const nextSignalsByDate: Record<string, DaySignal[]> = {};
      const hardBlocked = new Set<string>();
      const softBlocked = new Set<string>();
      const holidays = new Set<string>();
      const reserved = new Set<string>();
      const recommended = new Set<string>();

      const pushSignal = (dateKey: string, signal: DaySignal) => {
        if (!nextSignalsByDate[dateKey]) {
          nextSignalsByDate[dateKey] = [];
        }
        nextSignalsByDate[dateKey].push(signal);
      };

      const clampStart = (input: Date) => (input < windowStart ? windowStart : input);
      const clampEnd = (input: Date) => (input > windowEnd ? windowEnd : input);

      const holidayRows = (holidaysRes.data as PublicHolidayRow[]) ?? [];
      holidayRows.forEach((holiday) => {
        const dateKey = holiday.date;
        holidays.add(dateKey);
        pushSignal(dateKey, {
          type: 'holiday',
          title: holiday.name,
          description: 'Public holiday',
        });
      });

      const blackoutRows = (blackoutRes.data as BlackoutPeriodRow[]) ?? [];
      blackoutRows.forEach((period) => {
        const rangeStart = clampStart(parseDateOnly(period.start_date));
        const rangeEnd = clampEnd(parseDateOnly(period.end_date));
        if (rangeStart > rangeEnd) return;

        forEachDateInRange(rangeStart, rangeEnd, (day) => {
          const dateKey = toDateKey(day);
          if (period.severity === 'hard') {
            hardBlocked.add(dateKey);
          } else {
            softBlocked.add(dateKey);
          }

          pushSignal(dateKey, {
            type: period.severity,
            title: period.title,
            description: period.description,
          });
        });
      });

      const leaveRows = (leaveRes.data as LeaveRecordRow[]) ?? [];
      leaveRows.forEach((record) => {
        const status = getDecisionStatus(record);
        if (status === 'DENIED') return;

        const rangeStart = parseDateOnly(record.start_date);
        const rawEnd = record.end_date
          ? parseDateOnly(record.end_date)
          : addDays(rangeStart, Math.max(record.days_requested, 1) - 1);

        const rangeStartClamped = clampStart(rangeStart);
        const rangeEndClamped = clampEnd(rawEnd);
        if (rangeStartClamped > rangeEndClamped) return;

        forEachDateInRange(rangeStartClamped, rangeEndClamped, (day) => {
          const dateKey = toDateKey(day);
          reserved.add(dateKey);
          pushSignal(dateKey, {
            type: 'reserved',
            title: `Existing leave request (${status})`,
            description: 'You already have leave activity on this date.',
          });
        });
      });

      forEachDateInRange(today, addDays(today, RECOMMENDATION_LOOKAHEAD_DAYS), (day) => {
        if (recommended.size >= MAX_RECOMMENDED_DAYS) return;
        if (isWeekend(day)) return;

        const dateKey = toDateKey(day);
        const hasConflict =
          hardBlocked.has(dateKey) ||
          softBlocked.has(dateKey) ||
          holidays.has(dateKey) ||
          reserved.has(dateKey);

        if (!hasConflict) {
          recommended.add(dateKey);
        }
      });

      setHardBlockedDates(Array.from(hardBlocked).map(parseDateOnly));
      setSoftBlockedDates(Array.from(softBlocked).map(parseDateOnly));
      setHolidayDates(Array.from(holidays).map(parseDateOnly));
      setReservedDates(Array.from(reserved).map(parseDateOnly));
      setRecommendedDates(Array.from(recommended).map(parseDateOnly));
      setSignalsByDate(nextSignalsByDate);
      setIsLoading(false);
    };

    loadCalendarSignals();

    return () => {
      isMounted = false;
    };
  }, [employeeId, department]);

  const selectedRange = useMemo<DateRange | undefined>(() => {
    if (!startDate) return undefined;
    const from = parseDateOnly(startDate);
    const to = parseDateOnly(endDate || startDate);
    return { from, to };
  }, [startDate, endDate]);

  const activeDateSignals = useMemo(
    () => (activeDate ? signalsByDate[activeDate] ?? [] : []),
    [activeDate, signalsByDate],
  );

  const hasCalendarData =
    hardBlockedDates.length > 0 ||
    softBlockedDates.length > 0 ||
    holidayDates.length > 0 ||
    reservedDates.length > 0;

  const today = startOfDay(new Date());

  return (
    <Card className="border-teal-200/80 bg-teal-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <CalendarDays className="h-5 w-5 text-teal-700" />
          Leave Planning Calendar
        </CardTitle>
        <CardDescription className="text-sm text-teal-900/80">
          Green dates are usually easier to request. Hard blackout dates are disabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading planning signals...
          </div>
        ) : null}

        {loadError ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
        ) : null}

        <div className="rounded-lg border bg-white p-2 sm:p-3">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={selectedRange}
            onSelect={(range) => {
              if (!range?.from) {
                onRangeChange('', '');
                return;
              }

              const nextStart = toDateKey(range.from);
              const nextEnd = range.to ? toDateKey(range.to) : nextStart;
              onRangeChange(nextStart, nextEnd);
              setActiveDate(nextEnd);
            }}
            onDayClick={(day) => {
              setActiveDate(toDateKey(day));
            }}
            defaultMonth={selectedRange?.from ?? today}
            disabled={[{ before: today }, ...hardBlockedDates]}
            modifiers={{
              hard: hardBlockedDates,
              soft: softBlockedDates,
              holiday: holidayDates,
              reserved: reservedDates,
              recommended: recommendedDates,
            }}
            modifiersStyles={{
              hard: {
                backgroundColor: '#fca5a5',
                color: '#7f1d1d',
              },
              soft: {
                backgroundColor: '#fde68a',
                color: '#78350f',
              },
              holiday: {
                backgroundColor: '#bfdbfe',
                color: '#1e3a8a',
              },
              reserved: {
                backgroundColor: '#d4d4d8',
                color: '#18181b',
              },
              recommended: {
                boxShadow: 'inset 0 0 0 2px #14b8a6',
                borderRadius: '9999px',
              },
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border border-red-200 bg-red-300" />
            <span>Hard blackout (blocked)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border border-amber-300 bg-amber-300" />
            <span>Soft blackout (review carefully)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border border-blue-300 bg-blue-300" />
            <span>Public holidays</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border border-zinc-400 bg-zinc-300" />
            <span>Your existing leave activity</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-teal-500 bg-white" />
            <span>Recommended request dates</span>
          </div>
        </div>

        {activeDate && activeDateSignals.length > 0 ? (
          <div className="rounded-md border bg-white p-3">
            <p className="mb-2 text-sm font-medium text-foreground">
              Activity on {format(parseDateOnly(activeDate), 'EEE, MMM d, yyyy')}
            </p>
            <div className="space-y-2">
              {activeDateSignals.map((signal, index) => (
                <div key={`${signal.type}-${signal.title}-${index}`} className="space-y-1">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${severityStyles[signal.type]}`}>
                    {severityLabels[signal.type]}
                  </span>
                  <p className="text-xs font-medium text-foreground">{signal.title}</p>
                  {signal.description ? (
                    <p className="text-xs text-muted-foreground">{signal.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!isLoading && !hasCalendarData ? (
          <p className="text-xs text-muted-foreground">
            No blackout or holiday entries found yet. You can still pick leave dates.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

