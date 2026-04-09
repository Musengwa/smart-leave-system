import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar } from '../components/ui/avatar';
import { Bot, User, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export default function AIChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'pending' | 'approved' | 'needs-revision' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const leaveRequest = location.state?.leaveRequest;

  useEffect(() => {
    if (!leaveRequest) {
      navigate('/leave-request');
      return;
    }

    // Initial AI greeting
    const initialMessage: Message = {
      id: '1',
      sender: 'ai',
      text: `Hello ${user?.name}! I'm your AI Leave Management Assistant. I've reviewed your leave request:\n\n📋 Leave Type : ${formatLeaveType(leaveRequest.leaveType)}\n📅 Dates : ${formatDate(leaveRequest.startDate)} to ${formatDate(leaveRequest.endDate)}\n💬 Reason : ${leaveRequest.reason}\n\nI'll help you process this request. Based on company policy and team availability, I can provide recommendations. How can I assist you further?`,
      timestamp: new Date(),
    };
    setMessages([initialMessage]);
  }, [leaveRequest, user, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatLeaveType = (type: string) => {
    return type
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateDays = () => {
    if (!leaveRequest) return 0;
    const start = new Date(leaveRequest.startDate);
    const end = new Date(leaveRequest.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const generateAIResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Check for approval request
    if (lowerMessage.includes('approve') || lowerMessage.includes('submit') || lowerMessage.includes('finalize')) {
      setRequestStatus('approved');
      return `Great! I've reviewed your request and everything looks good. ✅\n\n Your leave request has been approved!\n\n📋 Summary:\n• Leave Type: ${formatLeaveType(leaveRequest.leaveType)}\n• Duration: ${calculateDays()} days\n• Dates: ${formatDate(leaveRequest.startDate)} - ${formatDate(leaveRequest.endDate)}\n\nYour manager will receive a notification, and the leave will be reflected in your balance. You can view the status in your dashboard.\n\nIs there anything else you'd like to know?`;
    }

    // Check for alternative dates
    if (lowerMessage.includes('alternative') || lowerMessage.includes('different date') || lowerMessage.includes('suggest')) {
      const currentStart = new Date(leaveRequest.startDate);
      const altDate1 = new Date(currentStart);
      altDate1.setDate(altDate1.getDate() + 7);
      const altDate2 = new Date(currentStart);
      altDate2.setDate(altDate2.getDate() + 14);
      
      return `Based on team availability and workload, here are some alternative dates that might work better:\n\n Option 1:  ${altDate1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(altDate1.getTime() + calculateDays() * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}\n• Team coverage: Excellent\n• Pending deadlines: None\n\n Option 2:  ${altDate2.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(altDate2.getTime() + calculateDays() * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}\n• Team coverage: Good\n• Pending deadlines: None\n\nWould you like to proceed with any of these alternatives, or stick with your original dates?`;
    }
 
    // Check for policy questions
    if (lowerMessage.includes('policy') || lowerMessage.includes('rules') || lowerMessage.includes('allowed')) {
      return `According to Zambian labor law and company policy:\n\n• Annual leave: 24 days per year\n• Sick leave: Up to 12 days with medical certificate\n• Maternity leave: 84 days (12 weeks)\n• Paternity leave: 7 days\n\nYou currently have 18 days of annual leave remaining. Your requested ${calculateDays()} days would leave you with ${18 - calculateDays()} days.\n\nWould you like me to explain any specific policy?`;
    }

    // Check for balance inquiry
    if (lowerMessage.includes('balance') || lowerMessage.includes('remaining') || lowerMessage.includes('how many')) {
      return `Your current leave balance:\n\n📊  Annual Leave:  18 days remaining\n📊  Sick Leave:  12 days remaining\n📊  Other Leave:  As per policy\n\nYour request for ${calculateDays()} days will leave you with ${18 - calculateDays()} days of annual leave. This is well within your allocation!\n\nWould you like to proceed with this request?`;
    }

    // Check for team/coverage questions
    if (lowerMessage.includes('team') || lowerMessage.includes('coverage') || lowerMessage.includes('busy')) {
      return `I've checked the team calendar for your requested dates:\n\n✅  Team Coverage:  Good\n• 2 team members will be available\n• No major project deadlines during this period\n• Handover can be arranged with John and Sarah\n\n📅  Recommended Actions: \n1. Brief your team on ongoing tasks\n2. Set up an out-of-office message\n3. Delegate urgent matters to available colleagues\n\nThe timing looks favorable for your leave. Would you like to proceed?`;
    }

    // Check for why/reason questions
    if (lowerMessage.includes('why') || lowerMessage.includes('reason') || lowerMessage.includes('explain')) {
      return `I understand you'd like more information. Your leave request is being evaluated based on:\n\n1.  Company Policy Compliance:  Your request meets all requirements\n2.  Leave Balance:  You have sufficient days available\n3.  Team Impact:  Coverage has been assessed\n4.  Notice Period:  Your request provides adequate notice\n\nAll factors are favorable. The main consideration is ensuring smooth workflow during your absence. Would you like to discuss any specific concerns?`;
    }

    // Default helpful response
    return `I'm here to help with your leave request! I can assist you with:\n\n• Reviewing your leave balance\n• Suggesting alternative dates\n• Explaining leave policies\n• Checking team availability\n• Processing your approval\n\nWhat would you like to know more about?`;
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: generateAIResponse(inputMessage),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (action: string) => {
    setInputMessage(action);
    setTimeout(() => handleSendMessage(), 100);
  };

  if (!leaveRequest) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">AI Leave Assistant</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            Discuss your leave request and get instant assistance
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Chat Area */}
          <Card className="lg:col-span-2">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Bot className="h-5 w-5 text-blue-600" />
                Chat with AI Assistant
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Ask questions, get suggestions, and finalize your leave request
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Messages */}
              <div className="h-[400px] sm:h-[500px] overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-2 sm:gap-3 ${
                      message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <Avatar className={`h-7 w-7 sm:h-8 sm:w-8 ${message.sender === 'ai' ? 'bg-blue-600' : 'bg-gray-600'} flex items-center justify-center flex-shrink-0`}>
                      {message.sender === 'ai' ? (
                        <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      ) : (
                        <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      )}
                    </Avatar>
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-2.5 sm:p-3 ${
                        message.sender === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{message.text}</p>
                      <p
                        className={`text-[10px] sm:text-xs mt-1 ${
                          message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex gap-2 sm:gap-3">
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8 bg-blue-600 flex items-center justify-center">
                      <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </Avatar>
                    <div className="bg-gray-100 rounded-lg p-2.5 sm:p-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t p-3 sm:p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isTyping}
                    className="text-sm sm:text-base"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTyping}
                    className="flex-shrink-0"
                    size="sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions & Info */}
          <div className="space-y-4 sm:space-y-6">
            {/* Request Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Request Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Leave Type</p>
                  <p className="font-medium text-sm sm:text-base">{formatLeaveType(leaveRequest.leaveType)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Duration</p>
                  <p className="font-medium text-sm sm:text-base">{calculateDays()} days</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Dates</p>
                  <p className="font-medium text-xs sm:text-sm">
                    {formatDate(leaveRequest.startDate)} - {formatDate(leaveRequest.endDate)}
                  </p>
                </div>
                {requestStatus && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    requestStatus === 'approved' ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      {requestStatus === 'approved' ? (
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                      ) : (
                        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                      )}
                      <span className="font-medium text-sm sm:text-base">
                        {requestStatus === 'approved' ? 'Approved' : 'Needs Revision'}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Common questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs sm:text-sm h-auto py-2"
                  onClick={() => handleQuickAction('Can you suggest alternative dates?')}
                >
                  Suggest alternative dates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs sm:text-sm h-auto py-2"
                  onClick={() => handleQuickAction('What is my leave balance?')}
                >
                  Check leave balance
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs sm:text-sm h-auto py-2"
                  onClick={() => handleQuickAction('Is my team available during this period?')}
                >
                  Check team availability
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs sm:text-sm h-auto py-2 text-green-600"
                  onClick={() => handleQuickAction('Please approve and submit my request')}
                >
                  submit request
                </Button>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                className="w-full text-sm sm:text-base"
                onClick={() => {
                  toast.success('Leave request submitted successfully!');
                  navigate('/dashboard');
                }}
              >
                Return to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}