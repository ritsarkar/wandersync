import React, { useState, useRef, useEffect } from 'react';
import { GroupMessage } from '../types';
import { Send, MessageSquare, AlertCircle, Fuel, Coffee, AlertTriangle, Camera, Wrench } from 'lucide-react';

interface ChatDrawerProps {
  messages: GroupMessage[];
  currentUserId: string;
  onSendMessage: (text: string, type: 'chat' | 'ping') => void;
  onClose?: () => void;
}

const QUICK_PINGS = [
  { icon: '⛽', text: 'Stopping for Fuel', label: 'Fuel' },
  { icon: '☕', text: 'Coffee & Rest Break', label: 'Break' },
  { icon: '🛑', text: 'Heavy Traffic Delay Ahead', label: 'Traffic' },
  { icon: '📸', text: 'Incredible Scenic Photo Spot!', label: 'Scenic' },
  { icon: '🔧', text: 'Checking Vehicle / Mechanical issue', label: 'Issue' },
];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  currentUserId,
  onSendMessage,
  onClose,
}) => {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), 'chat');
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 text-slate-100 p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Squad Radar Chat</h2>
            <p className="text-xs text-slate-400">Live pings & road communication</p>
          </div>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* 1-Tap Travel Radar Pings */}
      <div className="py-2.5 border-b border-slate-800 shrink-0">
        <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 flex items-center gap-1">
          <span>⚡ 1-Tap Quick Pings</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {QUICK_PINGS.map((ping, idx) => (
            <button
              key={idx}
              onClick={() => onSendMessage(`${ping.icon} ${ping.text}`, 'ping')}
              className="shrink-0 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-purple-600/30 border border-slate-700 hover:border-purple-500/50 text-[11px] font-medium text-slate-300 hover:text-purple-300 transition flex items-center gap-1"
            >
              <span>{ping.icon}</span>
              <span>{ping.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          const isSystem = msg.type === 'system';
          const isSOS = msg.type === 'sos';
          const isPing = msg.type === 'ping';

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center my-2">
                <span className="inline-block px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700/50 text-[10px] font-medium text-slate-400">
                  {msg.text}
                </span>
              </div>
            );
          }

          if (isSOS) {
            return (
              <div key={msg.id} className="p-3 rounded-xl bg-red-950/80 border-2 border-red-500/80 text-red-200 text-xs shadow-lg animate-pulse-fast">
                <div className="flex items-center gap-2 font-bold text-red-400 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>EMERGENCY DISTRESS BEACON</span>
                </div>
                <p className="font-medium text-[11px]">{msg.text}</p>
                <div className="mt-1 text-[9px] text-red-400/80 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5 px-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: msg.senderColor || '#3b82f6' }}
                />
                <span className="text-[11px] font-semibold text-slate-400">
                  {isMe ? 'You' : msg.senderName}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div
                className={`px-3 py-2 rounded-2xl max-w-[85%] text-xs shadow-md ${
                  isPing
                    ? 'bg-gradient-to-r from-purple-900/60 to-indigo-900/60 border border-purple-500/50 text-purple-200 font-medium'
                    : isMe
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="pt-2 border-t border-slate-800 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message travel group..."
          className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 transition"
        />
        <button
          type="submit"
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/50 transition disabled:opacity-50"
          disabled={!inputText.trim()}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
