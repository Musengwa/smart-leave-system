import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar } from '../components/ui/avatar';
import { Bot, User, Send, CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { sendChatMessage, DecisionResult } from '../services/leaveService';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

// ─── Decision badge config ────────────────────────────────────────────────────

const DECISION_CONFIG = {
  APPROVED:     { label: 'Approved',      color: 'bg-teal-100 text-teal-900',   Icon: CheckCircle  },
  DENIED:       { label: 'Denied',        color: 'bg-zinc-200 text-zinc-900',   Icon: XCircle      },
  PENDING_INFO: { label: 'Pending Info',  color: 'bg-teal-50 text-teal-800',    Icon: Clock        },
  REFER_HR:     { label: 'Referred to HR',color: 'bg-zinc-100 text-zinc-800',   Icon: AlertCircle  },
};

export default function AIChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [chatEnabled, setChatEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Data passed from LeaveRequest form
  const leaveRequest = location.state?.leaveRequest;
  const sessionId    = location.state?.sessionId;
  const openingMsg   = location.state?.openingMessage;
  const initialDecision = location.state?.decision;

  useEffect(() => {
    if (!leaveRequest || !sessionId) {
      navigate('/leave-request');
      return;
    }

    // Set initial decision from engine
    if (initialDecision) setDecision(initialDecision);

    // Show the opening AI message returned from the backend
    if (openingMsg) {
      setMessages([{
        id: '1',
        sender: 'ai',
        text: openingMsg,
        timestamp: new Date(),
      }]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatLeaveType = (type: string) =>
    type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const calculateDays = () => {
    if (!leaveRequest) return 0;
    const start = new Date(leaveRequest.startDate);
    const end = new Date(leaveRequest.endDate);
    return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !chatEnabled) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const response = await sendChatMessage(sessionId, inputMessage);

      // Update decision if engine re-evaluated
      if (response.decisionChanged) {
        setDecision(response.decision);
        if (!response.chatEnabled) {
          setChatEnabled(false);
          toast.warning('Your request has been referred to HR.');
        }
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: response.reply,
        timestamp: new Date(),
      }]);

    } catch (err: any) {
      toast.error(err.message || 'Failed to send message. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (text: string) => {
    setInputMessage(text);
    // Small delay so state updates before send
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'user',
        text,
        timestamp: new Date(),
      }]);
      setInputMessage('');
      setIsTyping(true);

      sendChatMessage(sessionId, text)
        .then(response => {
          if (response.decisionChanged) setDecision(response.decision);
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: response.reply,
            timestamp: new Date(),
          }]);
        })
        .catch(err => toast.error(err.message))
        .finally(() => setIsTyping(false));
    }, 100);
  };

  if (!leaveRequest) return null;

  const decisionCfg = decision ? DECISION_CONFIG[decision.decision] : null;

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">AI Leave Assistant</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Discuss your leave request and get instant assistance
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

          {/* ── Chat Area ── */}
          <Card className="lg:col-span-2">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Bot className="h-5 w-5 text-teal-600" />
                Chat with AI Assistant
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Ask questions, get suggestions, and discuss your leave request
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">

              {/* Messages */}
              <div className="h-[400px] sm:h-[500px] overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-2 sm:gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <Avatar className={`h-7 w-7 sm:h-8 sm:w-8 ${message.sender === 'ai' ? 'bg-teal-600' : 'bg-zinc-900'} flex items-center justify-center flex-shrink-0`}>
                      {message.sender === 'ai'
                        ? <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                        : <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      }
                    </Avatar>
                    <div className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-2.5 sm:p-3 ${
                      message.sender === 'user' ? 'bg-black text-white' : 'bg-teal-50 text-zinc-900'
                    }`}>
                      <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{message.text}</p>
                      <p className={`text-[10px] sm:text-xs mt-1 ${message.sender === 'user' ? 'text-zinc-300' : 'text-teal-700'}`}>
                        {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex gap-2 sm:gap-3">
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8 bg-teal-600 flex items-center justify-center">
                      <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </Avatar>
                    <div className="bg-teal-50 rounded-lg p-2.5 sm:p-3">
                      <div className="flex gap-1">
                        {[0, 0.2, 0.4].map((delay, i) => (
                          <div key={i} className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: `${delay}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t p-3 sm:p-4">
                {!chatEnabled ? (
                  <p className="text-sm text-center text-muted-foreground py-2">
                    This request has been referred to HR. Chat is no longer available.
                  </p>
                ) : (
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
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Sidebar ── */}
          <div className="space-y-4 sm:space-y-6">

            {/* Request Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Request Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Leave Type</p>
                  <p className="font-medium text-sm sm:text-base">{formatLeaveType(leaveRequest.leaveType)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium text-sm sm:text-base">{calculateDays()} days</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Dates</p>
                  <p className="font-medium text-xs sm:text-sm">
                    {formatDate(leaveRequest.startDate)} — {formatDate(leaveRequest.endDate)}
                  </p>
                </div>

                {/* Decision badge */}
                {decisionCfg && (
                  <div className={`mt-4 p-3 rounded-lg ${decisionCfg.color}`}>
                    <div className="flex items-center gap-2">
                      <decisionCfg.Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="font-medium text-sm sm:text-base">{decisionCfg.label}</span>
                    </div>
                    {decision?.reason && (
                      <p className="text-xs mt-1 opacity-80">{decision.reason}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            {chatEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Common questions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs sm:text-sm h-auto py-2"
                    onClick={() => handleQuickAction('Can you suggest alternative dates?')}>
                    Suggest alternative dates
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs sm:text-sm h-auto py-2"
                    onClick={() => handleQuickAction('What is my leave balance?')}>
                    Check leave balance
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs sm:text-sm h-auto py-2"
                    onClick={() => handleQuickAction('Why was this decision made?')}>
                    Explain this decision
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs sm:text-sm h-auto py-2"
                    onClick={() => handleQuickAction('What are my options from here?')}>
                    What are my options?
                  </Button>
                </CardContent>
              </Card>
            )}

            <Button className="w-full text-sm sm:text-base" onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
