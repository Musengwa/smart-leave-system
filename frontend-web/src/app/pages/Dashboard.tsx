import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '../components/ui/chart';
import { supabase } from '../../lib/supabase';
import { FileText, BookOpen, Calendar, Clock, CheckCircle2, Loader2, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from 'recharts';

type LeaveDecision = 'APPROVED' | 'DENIED' | 'REFER_HR' | 'PENDING_INFO';

interface LeaveRecordRow {
  id: string;
  leave_type: string;
  days_requested: number;
  days_approved: number | null;
  start_date: string;
  created_at: string;
  final_decision: LeaveDecision | null;
  decision: {
    decision?: LeaveDecision;
  } | null;
}

interface EmployeeBalancesRow {
  balance_annual: number;
  balance_sick: number;
  balance_maternity: number;
  balance_paternity: number;
  balance_compassionate: number;
  balance_study: number;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual',
  sick: 'Sick',
  maternity: 'Maternity',
  paternity: 'Paternity',
  compassionate: 'Compassionate',
  study: 'Study',
};

const STATUS_META: Record<
  LeaveDecision,
  {
    label: string;
    badge: string;
    chartKey: 'approved' | 'pending' | 'denied' | 'referred';
  }
> = {
  APPROVED: {
    label: 'Approved',
    badge: 'bg-green-100 text-green-800',
    chartKey: 'approved',
  },
  PENDING_INFO: {
    label: 'Pending',
    badge: 'bg-yellow-100 text-yellow-800',
    chartKey: 'pending',
  },
  DENIED: {
    label: 'Denied',
    badge: 'bg-red-100 text-red-800',
    chartKey: 'denied',
  },
  REFER_HR: {
    label: 'Referred to HR',
    badge: 'bg-orange-100 text-orange-800',
    chartKey: 'referred',
  },
};

const statusChartConfig = {
  approved: { label: 'Approved', color: 'var(--color-chart-2)' },
  pending: { label: 'Pending', color: 'var(--color-chart-4)' },
  denied: { label: 'Denied', color: 'var(--color-chart-1)' },
  referred: { label: 'Referred to HR', color: 'var(--color-chart-3)' },
} satisfies ChartConfig;

const leaveTypeChartConfig = {
  annual: { label: 'Annual', color: 'var(--color-chart-1)' },
  sick: { label: 'Sick', color: 'var(--color-chart-2)' },
  maternity: { label: 'Maternity', color: 'var(--color-chart-3)' },
  paternity: { label: 'Paternity', color: 'var(--color-chart-4)' },
  compassionate: { label: 'Compassionate', color: 'var(--color-chart-5)' },
  study: { label: 'Study', color: '#6366f1' },
} satisfies ChartConfig;

const monthlyChartConfig = {
  submitted: { label: 'Submitted', color: 'var(--color-chart-1)' },
  approved: { label: 'Approved', color: 'var(--color-chart-2)' },
} satisfies ChartConfig;

const parseDateOnly = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDateRange = (startDate: string, days: number) => {
  const start = parseDateOnly(startDate);
  const safeDays = Math.max(days, 1);
  const end = new Date(start);
  end.setDate(start.getDate() + safeDays - 1);

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (safeDays === 1) {
    return formatter.format(start);
  }

  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

const getRecordStatus = (record: LeaveRecordRow): LeaveDecision =>
  record.final_decision ?? record.decision?.decision ?? 'PENDING_INFO';

export default function Dashboard() {
  const { user } = useAuth();
  const [balances, setBalances] = useState(user?.balances ?? null);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = async () => {
      if (!user?.id) {
        if (isMounted) {
          setLoading(false);
          setLoadError('No employee account found.');
        }
        return;
      }

      setLoading(true);
      setLoadError(null);

      const [employeeRes, recordsRes] = await Promise.all([
        supabase
          .from('employees')
          .select(
            'balance_annual, balance_sick, balance_maternity, balance_paternity, balance_compassionate, balance_study',
          )
          .eq('id', user.id)
          .maybeSingle<EmployeeBalancesRow>(),
        supabase
          .from('leave_records')
          .select(
            'id, leave_type, days_requested, days_approved, start_date, created_at, final_decision, decision',
          )
          .eq('employee_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (!isMounted) return;

      if (employeeRes.error || recordsRes.error) {
        setLoadError('Failed to load live dashboard statistics.');
        setLoading(false);
        return;
      }

      if (employeeRes.data) {
        setBalances({
          annual: employeeRes.data.balance_annual,
          sick: employeeRes.data.balance_sick,
          maternity: employeeRes.data.balance_maternity,
          paternity: employeeRes.data.balance_paternity,
          compassionate: employeeRes.data.balance_compassionate,
          study: employeeRes.data.balance_study,
        });
      }

      setLeaveRecords((recordsRes.data as LeaveRecordRow[]) ?? []);
      setLoading(false);
    };

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const currentYear = new Date().getFullYear();
  const pendingRequests = useMemo(
    () => leaveRecords.filter((record) => getRecordStatus(record) === 'PENDING_INFO').length,
    [leaveRecords],
  );
  const approvedThisYear = useMemo(
    () =>
      leaveRecords.filter((record) => {
        const status = getRecordStatus(record);
        const leaveYear = parseDateOnly(record.start_date).getFullYear();
        return status === 'APPROVED' && leaveYear === currentYear;
      }).length,
    [leaveRecords, currentYear],
  );

  const stats = [
    {
      title: 'Annual Balance',
      value: `${balances?.annual ?? 0} days`,
      description: 'Annual leave remaining',
      icon: Calendar,
      color: 'text-blue-600',
    },
    {
      title: 'Pending Requests',
      value: String(pendingRequests),
      description: 'Awaiting final decision',
      icon: Clock,
      color: 'text-yellow-600',
    },
    {
      title: 'Approved Leaves',
      value: String(approvedThisYear),
      description: `Approved in ${currentYear}`,
      icon: CheckCircle2,
      color: 'text-green-600',
    },
  ];

  const statusChartData = useMemo(() => {
    const counts = leaveRecords.reduce<Record<'approved' | 'pending' | 'denied' | 'referred', number>>(
      (acc, record) => {
        const key = STATUS_META[getRecordStatus(record)].chartKey;
        acc[key] += 1;
        return acc;
      },
      { approved: 0, pending: 0, denied: 0, referred: 0 },
    );

    return Object.entries(counts)
      .map(([status, value]) => ({
        status,
        value,
        fill: `var(--color-${status})`,
      }))
      .filter((entry) => entry.value > 0);
  }, [leaveRecords]);

  const leaveTypeChartData = useMemo(() => {
    const totals = leaveRecords.reduce<Record<string, number>>((acc, record) => {
      if (getRecordStatus(record) !== 'APPROVED') return acc;
      const type = record.leave_type;
      const approvedDays = record.days_approved ?? record.days_requested;
      acc[type] = (acc[type] ?? 0) + approvedDays;
      return acc;
    }, {});

    return Object.entries(totals)
      .map(([leaveType, value]) => ({
        leaveType,
        value,
        fill: `var(--color-${leaveType})`,
      }))
      .filter((entry) => entry.value > 0);
  }, [leaveRecords]);

  const monthlyBarData = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
      return {
        key,
        month: monthFormatter.format(monthDate),
        submitted: 0,
        approved: 0,
      };
    });

    const monthIndex = new Map(months.map((item, idx) => [item.key, idx]));

    leaveRecords.forEach((record) => {
      const createdAt = new Date(record.created_at);
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
      const idx = monthIndex.get(key);
      if (idx === undefined) return;

      months[idx].submitted += 1;
      if (getRecordStatus(record) === 'APPROVED') {
        months[idx].approved += 1;
      }
    });

    return months;
  }, [leaveRecords]);

  const quickActions = [
    {
      title: 'Submit Leave Request',
      description: 'Request time off with AI assistance',
      icon: FileText,
      link: '/leave-request',
      color: 'bg-blue-600',
    },
    {
      title: 'View Leave Policies',
      description: 'Review company leave rules',
      icon: BookOpen,
      link: '/rules',
      color: 'bg-purple-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            Manage your leave requests with our AI-powered system
          </p>
        </div>

        {loading && (
          <Card className="mb-6 sm:mb-8">
            <CardContent className="py-8 flex items-center justify-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading live dashboard data...
            </CardContent>
          </Card>
        )}

        {loadError && (
          <Card className="mb-6 sm:mb-8 border-red-200">
            <CardContent className="py-4 text-sm text-red-700">{loadError}</CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-blue-600" />
                Request Status
              </CardTitle>
              <CardDescription className="text-sm">Distribution across all requests</CardDescription>
            </CardHeader>
            <CardContent>
              {statusChartData.length ? (
                <ChartContainer config={statusChartConfig} className="h-[260px] w-full">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="status" />} />
                    <Pie data={statusChartData} dataKey="value" nameKey="status" innerRadius={50} outerRadius={90}>
                      {statusChartData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-gray-500">No leave requests yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-indigo-600" />
                Approved Days by Type
              </CardTitle>
              <CardDescription className="text-sm">How approved leave days are allocated</CardDescription>
            </CardHeader>
            <CardContent>
              {leaveTypeChartData.length ? (
                <ChartContainer config={leaveTypeChartConfig} className="h-[260px] w-full">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="leaveType" />} />
                    <Pie data={leaveTypeChartData} dataKey="value" nameKey="leaveType" innerRadius={50} outerRadius={90}>
                      {leaveTypeChartData.map((entry) => (
                        <Cell key={entry.leaveType} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="leaveType" />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-gray-500">No approved leave days yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                Monthly Trend
              </CardTitle>
              <CardDescription className="text-sm">Submitted vs approved in the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={monthlyChartConfig} className="h-[260px] w-full">
                <BarChart data={monthlyBarData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="submitted" fill="var(--color-submitted)" radius={4} />
                  <Bar dataKey="approved" fill="var(--color-approved)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link to={action.link} key={index}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        <div className={`${action.color} p-3 rounded-lg`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle>{action.title}</CardTitle>
                          <CardDescription>{action.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Recent Leave Requests</CardTitle>
            <CardDescription className="text-sm">Your latest leave applications</CardDescription>
          </CardHeader>
          <CardContent>
            {!leaveRecords.length ? (
              <p className="text-sm text-gray-500">No leave requests submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {leaveRecords.slice(0, 5).map((record) => {
                  const status = getRecordStatus(record);
                  const statusMeta = STATUS_META[status];
                  const leaveLabel = `${LEAVE_TYPE_LABELS[record.leave_type] ?? record.leave_type} Leave`;

                  return (
                    <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b last:border-b-0 gap-2">
                      <div>
                        <div className="font-medium text-gray-900 text-sm sm:text-base">{leaveLabel}</div>
                        <div className="text-xs sm:text-sm text-gray-500">
                          {formatDateRange(record.start_date, record.days_requested)}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusMeta.badge} self-start sm:self-center`}>
                        {statusMeta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
