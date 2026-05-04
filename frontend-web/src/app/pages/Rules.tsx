import { Navbar } from '../components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { BookOpen, Calendar, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function Rules() {
  const leaveTypes = [
    {
      title: 'Annual Leave',
      icon: Calendar,
      color: 'text-teal-600',
      entitlement: '24 working days per year',
      description: 'All employees are entitled to paid annual leave after completing 12 months of continuous service.',
      rules: [
        'Must be taken within 12 months of accrual',
        'Can be carried forward to the next year (maximum 5 days)',
        'Requires 2 weeks advance notice for leave exceeding 5 days',
        'Can be taken in portions with supervisor approval',
      ],
    },
    {
      title: 'Sick Leave',
      icon: AlertCircle,
      color: 'text-zinc-900',
      entitlement: 'Up to 12 days per year',
      description: 'Paid sick leave is provided for genuine illness or injury that prevents an employee from working.',
      rules: [
        'Medical certificate required for absences exceeding 2 consecutive days',
        'Employee must notify supervisor within 24 hours of absence',
        'Can be extended with valid medical documentation',
        'Does not accumulate to the following year',
      ],
    },
    {
      title: 'Maternity Leave',
      icon: FileText,
      color: 'text-teal-700',
      entitlement: '84 days (12 weeks)',
      description: 'Female employees are entitled to maternity leave before and after childbirth.',
      rules: [
        'Can be taken from 4 weeks before expected delivery date',
        'Must provide medical certificate confirming pregnancy',
        'Full pay for the entire duration',
        'Position is protected during leave period',
      ],
    },
    {
      title: 'Paternity Leave',
      icon: FileText,
      color: 'text-zinc-700',
      entitlement: '7 working days',
      description: 'Male employees are entitled to paternity leave upon the birth of their child.',
      rules: [
        'Must be taken within 4 weeks of birth',
        'Full pay for the entire duration',
        'Requires birth certificate or hospital documentation',
        'Can be extended in special circumstances',
      ],
    },
    {
      title: 'Compassionate Leave',
      icon: Clock,
      color: 'text-teal-500',
      entitlement: 'Up to 5 days',
      description: 'Granted in case of death or serious illness of immediate family members.',
      rules: [
        'Immediate family includes spouse, children, parents, and siblings',
        'Requires proof of death or hospital admission',
        'Can be extended with approval from HR',
        'Fully paid leave',
      ],
    },
    {
      title: 'Study Leave',
      icon: BookOpen,
      color: 'text-zinc-800',
      entitlement: 'As approved by management',
      description: 'Employees pursuing further education may apply for study leave.',
      rules: [
        'Must be relevant to current role or career development',
        'Requires approval from department head and HR',
        'May be paid or unpaid depending on circumstances',
        'Employee may be required to sign a bond',
      ],
    },
  ];

  const generalPolicies = [
    {
      title: 'Leave Application Process',
      items: [
        'All leave requests must be submitted through the HR system',
        'Supervisor approval is required before leave is confirmed',
        'Emergency leave can be applied retrospectively within 48 hours',
        'Leave dates are subject to business requirements and may be declined',
      ],
    },
    {
      title: 'Notice Periods',
      items: [
        'Annual leave (1-5 days): Minimum 1 week notice',
        'Annual leave (6+ days): Minimum 2 weeks notice',
        'Urgent leave: As soon as reasonably possible',
        'Planned medical procedures: 4 weeks notice',
      ],
    },
    {
      title: 'Leave During Probation',
      items: [
        'New employees can apply for leave after 3 months of service',
        'Emergency and sick leave available from day one',
        'Annual leave accrues from the first day but can only be taken after probation',
        'Special circumstances may be considered by management',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Leave Policies & Rules</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Comprehensive guide to leave entitlements and policies in accordance with Zambian Labor Law
          </p>
        </div>

        {/* Important Notice */}
        <Card className="mb-6 sm:mb-8 border-teal-200 bg-teal-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-teal-900 text-sm sm:text-base">Important Information</p>
                <p className="text-xs sm:text-sm text-teal-800 mt-1">
                  These policies comply with the Employment Code Act (Cap 268) of the Laws of Zambia. 
                  All leave requests are subject to operational requirements and management approval. 
                  For specific queries, please consult with HR.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave Types */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-4">Types of Leave</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {leaveTypes.map((leave, index) => {
              const Icon = leave.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-50 rounded-lg">
                        <Icon className={`h-6 w-6 ${leave.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{leave.title}</CardTitle>
                        <CardDescription className="text-sm font-medium text-muted-foreground">
                          {leave.entitlement}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{leave.description}</p>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Key Rules:</p>
                      <ul className="space-y-1">
                        {leave.rules.map((rule, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-zinc-700 flex-shrink-0 mt-0.5" />
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* General Policies */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-4">General Policies</h2>
          <Card>
            <CardContent className="pt-6">
              <Accordion type="single" collapsible className="w-full">
                {generalPolicies.map((policy, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      <span className="font-medium">{policy.title}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 pl-4">
                        {policy.items.map((item, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-teal-600 mt-1">&bull;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Additional Information</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Important details about leave management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium text-foreground mb-2 text-sm sm:text-base">Public Holidays</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Zambian public holidays are in addition to annual leave entitlement. If a public holiday 
                falls during approved leave, it is not counted as part of your leave days.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-foreground mb-2 text-sm sm:text-base">Leave Balance</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Your current leave balance is always visible on your dashboard. Leave accrues monthly 
                and is calculated on a pro-rata basis for the first year of employment.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-foreground mb-2 text-sm sm:text-base">Cancellation Policy</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Approved leave can be cancelled by either the employee or management. Employees should 
                give as much notice as possible. The company reserves the right to recall employees 
                from leave in exceptional circumstances.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-foreground mb-2 text-sm sm:text-base">Documentation</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                All leave must be documented in the HR system. Employees should keep copies of approved 
                leave forms and any supporting documents (medical certificates, etc.) for their records.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="mt-6 sm:mt-8 border-teal-100 bg-teal-50/60">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-muted-foreground">
                For questions about leave policies or specific circumstances, please contact:
              </p>
              <p className="font-medium text-foreground mt-2 text-sm sm:text-base">HR Department</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Email: don@joe.zm</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

