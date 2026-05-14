import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Bot, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type LeaveType = 'annual' | 'sick' | 'maternity' | 'paternity' | 'compassionate' | 'study';

interface AdviceMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

interface BalanceMap {
  annual?: number;
  sick?: number;
  maternity?: number;
  paternity?: number;
  compassionate?: number;
  study?: number;
  [key: string]: number | undefined;
}

export interface AdvicePrefillData {
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
  reason?: string;
  hasMedicalCert?: boolean;
  isEmergency?: boolean;
}

interface AdviceChatProps {
  balances: BalanceMap;
  onPrefillChange: (info: AdvicePrefillData) => void;
  onFinalize?: (info: AdvicePrefillData) => void;
}

const initialAdvice = (balances: BalanceMap) =>
  `Hi there! 👋 I'm your leave advisor. I can help you figure out the best leave type and dates for your situation.

Your current balances:
${Object.entries(balances)
  .map(([type, days]) => `• ${type.charAt(0).toUpperCase() + type.slice(1)}: ${days ?? 0} days`)
  .join('\n')}

Just tell me what's going on – for example:
- "I'm sick tomorrow, have a doctor's note"
- "I need 3 days off next week for personal reasons"
- "I'm expecting a baby in March"

I'll help you figure out the right leave type and timing!`;

export function AdviceChat({ balances, onPrefillChange, onFinalize }: AdviceChatProps) {
  const [messages, setMessages] = useState<AdviceMessage[]>([
    { id: 'ai-1', sender: 'ai', text: initialAdvice(balances) },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Accumulate extracted details across entire conversation
  const [accumulatedDetails, setAccumulatedDetails] = useState<AdvicePrefillData>({});

  // Update initial message when balances change
  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length || prev[0].id !== 'ai-1') return prev;
      const updated = [...prev];
      updated[0] = { ...updated[0], text: initialAdvice(balances) };
      return updated;
    });
  }, [balances]);

  // Notify parent when accumulated details change
  useEffect(() => {
    onPrefillChange(accumulatedDetails);
  }, [accumulatedDetails, onPrefillChange]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: AdviceMessage = { id: `user-${Date.now()}`, sender: 'user', text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Convert messages to format expected by backend
      const history = messages.map((msg) => ({
        role: msg.sender as 'user' | 'assistant',
        content: msg.text,
      }));

      const response = await fetch('/advice/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          history,
          balances,
          currentDate: new Date().toISOString().split('T')[0],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to get advice');
      }

      const data = await response.json();
      const aiReply = data.reply || 'Sorry, I had trouble processing that. Can you tell me more?';
      const extracted = data.extracted || {};

      setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, sender: 'ai', text: aiReply }]);

      // ACCUMULATE extracted details: merge new details with existing ones
      // Later values override earlier ones, but we keep all info
      if (Object.keys(extracted).length > 0) {
        setAccumulatedDetails((prev) => ({
          ...prev,
          ...extracted,
          // Keep reason if not updated (so it doesn't get overwritten)
          reason: extracted.reason || prev.reason,
        }));
      }
    } catch (err: any) {
      console.error('[Advice Chat Error]', err);
      setError(err.message);
      toast.error(err.message || 'Failed to send message');
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'ai',
          text: "Sorry, I'm having trouble right now. Please try again or submit your request directly.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFinalize = useCallback(() => {
    // Pass the accumulated details to parent and finalize conversation
    if (onFinalize) {
      onFinalize(accumulatedDetails);
    }
  }, [accumulatedDetails, onFinalize]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Bot className="h-5 w-5 text-teal-600" />
          AI Leave Advisor
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        {error && (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-2 text-xs text-orange-800 flex gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto max-h-64 space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`rounded-lg px-3 py-2 text-xs sm:text-sm max-w-[85%] break-words ${
                  msg.sender === 'ai'
                    ? 'bg-teal-50 text-zinc-900 border border-teal-200'
                    : 'bg-black text-white border border-zinc-800'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-teal-50 rounded-lg px-3 py-2 text-xs border border-teal-200 text-teal-700 flex gap-1">
                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Tell me about your leave needs..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-xs sm:text-sm"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="sm" className="flex-shrink-0">
            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {/* Show finalize button to submit accumulated details */}
        {Object.keys(accumulatedDetails).length > 0 && (
          <Button
            onClick={handleFinalize}
            variant="secondary"
            size="sm"
            className="w-full text-xs"
          >
            Finalize & Continue to Form
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default AdviceChat;
