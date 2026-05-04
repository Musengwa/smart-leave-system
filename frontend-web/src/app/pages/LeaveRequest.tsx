import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { submitLeaveRequest, calculateDays } from '../services/leaveService';
import type { AdvicePrefillData } from '../components/AdviceChat';

type LeaveRequestLocationState = {
  prefill?: AdvicePrefillData;
};

const VALID_LEAVE_TYPES = new Set([
  'annual',
  'sick',
  'maternity',
  'paternity',
  'compassionate',
  'study',
]);

const isValidDateInput = (value: string | undefined) =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

export default function LeaveRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const prefill = (location.state as LeaveRequestLocationState | null)?.prefill;

  const initialFormData = useMemo(() => {
    const prefillLeaveType =
      typeof prefill?.leaveType === 'string' && VALID_LEAVE_TYPES.has(prefill.leaveType)
        ? prefill.leaveType
        : '';

    const prefillStartDate = isValidDateInput(prefill?.startDate) ? prefill?.startDate ?? '' : '';
    const prefillEndDate = isValidDateInput(prefill?.endDate)
      ? prefill?.endDate ?? ''
      : prefillStartDate;

    return {
      leaveType: prefillLeaveType,
      startDate: prefillStartDate,
      endDate: prefillEndDate,
      reason: typeof prefill?.reason === 'string' ? prefill.reason : '',
      hasMedicalCert: Boolean(prefill?.hasMedicalCert),
      isEmergency: Boolean(prefill?.isEmergency),
    };
  }, [prefill]);

  const [formData, setFormData] = useState({
    leaveType: initialFormData.leaveType,
    startDate: initialFormData.startDate,
    endDate: initialFormData.endDate,
    reason: initialFormData.reason,
    hasMedicalCert: initialFormData.hasMedicalCert,
    isEmergency: initialFormData.isEmergency,
  });

  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      toast.error('Employee record not found. Please log in again.');
      return;
    }

    setLoading(true);
    try {
      const days = calculateDays(formData.startDate, formData.endDate);

      const response = await submitLeaveRequest({
        employeeId: user.id,
        leaveType: formData.leaveType,
        daysRequested: days,
        startDate: formData.startDate,
        reason: formData.reason,
        hasMedicalCert: formData.hasMedicalCert,
        isEmergency: formData.isEmergency,
      });

      // REFER_HR - no chat, show message and go to dashboard
      if (!response.chatEnabled) {
        toast.warning('Your request has been referred to HR. Please contact HR directly.');
        navigate('/dashboard', {
          state: { referralMessage: response.message, decision: response.decision },
        });
        return;
      }

      // All other decisions - go to chat with session context
      navigate('/ai-chat', {
        state: {
          leaveRequest: formData,
          sessionId: response.sessionId,
          decision: response.decision,
          openingMessage: response.openingMessage,
        },
      });
    } catch (err: any) {
      const message = err?.message ?? 'Something went wrong. Please try again.';
      if (message.includes('[404]') && message.toLowerCase().includes('employee not found')) {
        toast.error(
          'Employee not found in backend database. Confirm frontend and backend use the same Supabase project.',
        );
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Submit Leave Request</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Fill out the form below and our AI assistant will help you finalize your request
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Calendar className="h-5 w-5" />
              Leave Request Form
            </CardTitle>
            <CardDescription className="text-sm">
              Provide your leave details. After submission, you'll chat with our AI assistant for
              approval and alternatives.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Employee Info */}
              <div className="bg-teal-50 p-4 rounded-lg space-y-2">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-sm text-muted-foreground">Employee Name:</span>
                  <span className="text-sm font-medium">{user?.name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-sm text-muted-foreground">Employee ID:</span>
                  <span className="text-sm font-medium">{user?.employeeId}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <span className="text-sm font-medium break-all">{user?.email}</span>
                </div>
              </div>

              {/* Leave Type */}
              <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type *</Label>
                <Select
                  value={formData.leaveType}
                  onValueChange={(value) => handleChange('leaveType', value)}
                  required
                >
                  <SelectTrigger id="leaveType">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="maternity">Maternity Leave</SelectItem>
                    <SelectItem value="paternity">Paternity Leave</SelectItem>
                    <SelectItem value="compassionate">Compassionate Leave</SelectItem>
                    <SelectItem value="study">Study Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleChange('endDate', e.target.value)}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Leave *</Label>
                <Textarea
                  id="reason"
                  placeholder="Please provide a brief explanation for your leave request..."
                  value={formData.reason}
                  onChange={(e) => handleChange('reason', e.target.value)}
                  rows={4}
                  required
                />
              </div>

              {/* Extra flags */}
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasMedicalCert}
                    onChange={(e) => handleChange('hasMedicalCert', e.target.checked)}
                  />
                  I have a medical certificate
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isEmergency}
                    onChange={(e) => handleChange('isEmergency', e.target.checked)}
                  />
                  This is an emergency
                </label>
              </div>

              {/* Info Box */}
              <div className="bg-teal-50 border border-teal-200 p-4 rounded-lg">
                <p className="text-xs sm:text-sm text-teal-900">
                  <strong>Next Step:</strong> After submitting, our AI assistant will review your
                  request against Zambian labour law and your leave balance, then guide you through
                  the outcome.
                </p>
              </div>

              {/* Submit */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 w-full"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 w-full"
                  disabled={
                    !formData.leaveType ||
                    !formData.startDate ||
                    !formData.endDate ||
                    !formData.reason ||
                    loading
                  }
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    'Continue to AI Assistant'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
