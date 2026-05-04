import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Bot, Send } from 'lucide-react';

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
}

const LEAVE_TYPES: LeaveType[] = [
  'annual',
  'sick',
  'maternity',
  'paternity',
  'compassionate',
  'study',
];

const initialAdvice = (balances: BalanceMap) =>
  `Hi! Your current leave balances are: Annual: ${balances.annual ?? 0}, Sick: ${balances.sick ?? 0}, Maternity: ${balances.maternity ?? 0}, Paternity: ${balances.paternity ?? 0}, Compassionate: ${balances.compassionate ?? 0}, Study: ${balances.study ?? 0}.\nAsk me about your leave options or type your intended leave details for quick advice!`;

const isValidDateInput = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const addDays = (startDate: string, days: number): string => {
  if (!isValidDateInput(startDate) || days <= 1) return startDate;
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + days - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const extractPrefillFromText = (text: string, reasonText?: string): AdvicePrefillData => {
  const lower = text.toLowerCase();

  const leaveType = LEAVE_TYPES.find((type) => lower.includes(type));
  const startDateMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  const daysMatch = lower.match(/\b(\d{1,3})\s*(day|days)\b/);
  const days = daysMatch ? Number(daysMatch[1]) : null;

  const hasMedicalCert =
    /\b(medical cert|medical certificate|doctor note|doctor's note)\b/.test(lower)
      ? true
      : /\b(no medical cert|without medical cert|no certificate)\b/.test(lower)
      ? false
      : undefined;

  const isEmergency =
    /\b(emergency|urgent)\b/.test(lower)
      ? true
      : /\b(not emergency|non-emergency)\b/.test(lower)
      ? false
      : undefined;

  const startDate = startDateMatch?.[0];
  const endDate = startDate && days ? addDays(startDate, days) : undefined;

  return {
    leaveType,
    startDate,
    endDate,
    reason: (reasonText ?? text).trim() || undefined,
    hasMedicalCert,
    isEmergency,
  };
};

export function AdviceChat({ balances, onPrefillChange }: AdviceChatProps) {
  const [messages, setMessages] = useState<AdviceMessage[]>([
    { id: 'ai-1', sender: 'ai', text: initialAdvice(balances) },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length || prev[0].id !== 'ai-1') return prev;
      const updated = [...prev];
      updated[0] = { ...updated[0], text: initialAdvice(balances) };
      return updated;
    });
  }, [balances]);

  const userHistoryText = useMemo(
    () =>
      messages
        .filter((msg) => msg.sender === 'user')
        .map((msg) => msg.text)
        .join('\n'),
    [messages],
  );
  const latestUserMessageText = useMemo(
    () => [...messages].reverse().find((msg) => msg.sender === 'user')?.text ?? '',
    [messages],
  );

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: AdviceMessage = { id: `user-${Date.now()}`, sender: 'user', text: input };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Simple keyword-based advice (replace with AI if needed)
    setTimeout(() => {
      let aiText = '';
      const lower = input.toLowerCase();
      if (lower.includes('balance')) {
        aiText = initialAdvice(balances);
      } else if (lower.match(/annual|sick|maternity|paternity|compassionate|study/)) {
        const type = lower.match(/annual|sick|maternity|paternity|compassionate|study/)?.[0];
        aiText = `You have ${balances[type ?? 'annual'] ?? 0} days for ${type}.`;
      } else if (lower.match(/\d{4}-\d{2}-\d{2}/)) {
        const date = lower.match(/\d{4}-\d{2}-\d{2}/)?.[0];
        aiText = `You mentioned the date ${date}. Would you like to start a leave request for this date?`;
      } else if (lower.includes('request') || lower.includes('apply')) {
        aiText = `Click 'Make Leave Request Now' to start your application. I can pre-fill details if you mention them here!`;
      } else {
        aiText = `I'm here to help with your leave questions. Ask about balances, types, or mention your intended leave.`;
      }
      setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, sender: 'ai', text: aiText }]);
      setIsTyping(false);
    }, 600);
    setInput('');
  };

  const extractRequestInfo = (): AdvicePrefillData =>
    extractPrefillFromText(userHistoryText, latestUserMessageText);

  useEffect(() => {
    onPrefillChange(extractRequestInfo());
  }, [onPrefillChange, userHistoryText, latestUserMessageText]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-5 w-5 text-teal-600" />
          Quick Leave Advice
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2">
        <div className="flex-1 overflow-y-auto max-h-60 space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-lg px-3 py-2 text-sm ${msg.sender === 'ai' ? 'bg-teal-50 text-zinc-900' : 'bg-black text-white'}`}>{msg.text}</div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-teal-50 rounded-lg px-3 py-2 text-sm text-teal-700 animate-pulse">Typing...</div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Ask about your leave..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="text-sm"
            disabled={isTyping}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isTyping} size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdviceChat;
