import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FileText, MessageSquare, BookOpen, Calendar, Clock, CheckCircle2 } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();

  const stats = [
    {
      title: 'Leave Balance',
      value: '18 days',
      description: 'Annual leave remaining',
      icon: Calendar,
      color: 'text-blue-600',
    },
    {
      title: 'Pending Requests',
      value: '2',
      description: 'Awaiting approval',
      icon: Clock,
      color: 'text-yellow-600',
    },
    {
      title: 'Approved Leaves',
      value: '5',
      description: 'This year',
      icon: CheckCircle2,
      color: 'text-green-600',
    },
  ];

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
            <div className="space-y-4">
              {[
                {
                  type: 'Annual Leave',
                  dates: 'Apr 15 - Apr 19, 2026',
                  status: 'Approved',
                  statusColor: 'bg-green-100 text-green-800',
                },
                {
                  type: 'Sick Leave',
                  dates: 'Mar 28, 2026',
                  status: 'Pending',
                  statusColor: 'bg-yellow-100 text-yellow-800',
                },
                {
                  type: 'Annual Leave',
                  dates: 'Feb 10 - Feb 14, 2026',
                  status: 'Approved',
                  statusColor: 'bg-green-100 text-green-800',
                },
              ].map((request, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b last:border-b-0 gap-2">
                  <div>
                    <div className="font-medium text-gray-900 text-sm sm:text-base">{request.type}</div>
                    <div className="text-xs sm:text-sm text-gray-500">{request.dates}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${request.statusColor} self-start sm:self-center`}>
                    {request.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}