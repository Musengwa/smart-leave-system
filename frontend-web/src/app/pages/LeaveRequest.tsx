import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar } from 'lucide-react';

export default function LeaveRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Navigate to AI chat with leave request data
    navigate('/ai-chat', { state: { leaveRequest: formData } });
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Submit Leave Request</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
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
              Provide your leave details. After submission, you'll chat with our AI assistant for approval and alternatives.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Employee Info */}
              <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-sm text-gray-600">Employee Name:</span>
                  <span className="text-sm font-medium">{user?.name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-sm text-gray-600">Employee ID:</span>
                  <span className="text-sm font-medium">{user?.employeeId}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-sm text-gray-600">Email:</span>
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
                    <SelectItem value="unpaid">Unpaid Leave</SelectItem>
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
                <p className="text-xs text-gray-500">
                  You'll have the opportunity to discuss this further with our AI assistant
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <p className="text-xs sm:text-sm text-amber-800">
                  <strong>Next Step:</strong> After submitting this form, you'll be connected with our AI assistant. 
                  The assistant will review your request, answer questions, and may suggest alternative dates if needed.
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 w-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 w-full"
                  disabled={!formData.leaveType || !formData.startDate || !formData.endDate || !formData.reason}
                >
                  Continue to AI Assistant
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}