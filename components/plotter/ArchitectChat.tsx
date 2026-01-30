import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  BrainCircuit,
  Network,
  Loader2,
  Globe,
  Send,
  Activity,
  HelpCircle,
  X,
  Check,
  Book,
  UserCheck,
  ChevronDown,
  WifiOff,
} from 'lucide-react';
import { ChatMessage } from '../../types/sync';
import { AiPersona } from '../../types/project';
import { getArtifact } from '../../services/storageService';
import { Card } from '../ui/DesignSystem';
import {
  useNeuralSync,
  useUI,
  useUIDispatch,
  useMetadata,
  useMetadataDispatch,
} from '../../contexts/StoryContext';
import * as Actions from '../../store/actions';

interface ArchitectChatProps {
  isSyncing: boolean;
  displayHistory: ChatMessage[];
  input: string;
  setInput: (val: string) => void;
  isTyping: boolean;
  onSendMessage: () => void;
  className?: string; // Allow external styling for flexible layout
  onClose?: () => void; // Mobile minimize action
}

const MessageBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const [loadedArtifact, setLoadedArtifact] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (msg.kind === 'artifact_ref' && msg.artifactId) {
      setLoading(true);
      getArtifact(msg.artifactId)
        .then((art) => {
          if (art) setLoadedArtifact(art.content);
        })
        .catch((e) => {
          console.error('Failed to load artifact', e);
          setLoadedArtifact('Error loading content.');
        })
        .finally(() => setLoading(false));
    } else {
      setLoadedArtifact(null);
    }
  }, [msg.kind, msg.artifactId]);

  const textToDisplay = loadedArtifact !== null ? loadedArtifact : msg.content;

  return (
    <div
      className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in w-full`}
    >
      <div
        className={`max-w-[85%] p-4 rounded-2xl text-[12px] md:text-[13px] leading-relaxed font-serif whitespace-pre-wrap shadow-lg ${msg.role === 'user' ? 'bg-stone-800 text-stone-200 rounded-br-none' : 'glass-bright text-stone-100 rounded-bl-none border border-white/5'}`}
      >
        {loading ? (
          <div className="flex items-center gap-2 text-stone-500">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-[10px]">Loading content...</span>
          </div>
        ) : (
          textToDisplay
        )}
      </div>
      {msg.sources && msg.sources.length > 0 && (
        <div className="grid grid-cols-1 gap-2 w-[85%]">
          {msg.sources.map((s, i) => (
            <a
              key={i}
              href={s.uri}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-2 bg-stone-950/60 rounded-xl border border-white/5 hover:border-orange-500/30 transition-all group"
            >
              <div className="p-1.5 bg-stone-800 rounded text-orange-400">
                <Globe size={12} />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] font-black text-stone-300 truncate uppercase tracking-widest">
                  {s.title}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

const PersonaSelector: React.FC = () => {
  const meta = useMetadata();
  const metaDispatch = useMetadataDispatch();
  const [isOpen, setIsOpen] = useState(false);

  const currentPersona = meta.preferences.aiPersona || AiPersona.STANDARD;

  const handleSelect = (p: AiPersona) => {
    metaDispatch(Actions.updatePreferences({ aiPersona: p }));
    setIsOpen(false);
  };

  const getLabel = (p: AiPersona) => {
    switch (p) {
      case AiPersona.STRICT:
        return '厳格';
      case AiPersona.GENTLE:
        return '肯定';
      case AiPersona.CREATIVE:
        return '拡散';
      default:
        return '標準';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[8px] font-black text-stone-500 hover:text-indigo-400 uppercase tracking-[0.2em] transition-colors"
        title="AI人格の変更"
      >
        <UserCheck size={10} /> {getLabel(currentPersona)}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-stone-900 border border-white/10 rounded-xl p-1 z-50 shadow-xl flex flex-col gap-1 w-32 animate-fade-in">
          {Object.values(AiPersona).map((p) => (
            <button
              key={p}
              onClick={() => handleSelect(p)}
              className={`text-left px-3 py-2 text-[9px] font-bold rounded-lg transition-colors ${currentPersona === p ? 'bg-indigo-500/20 text-indigo-400' : 'text-stone-400 hover:bg-stone-800 hover:text-white'}`}
            >
              {getLabel(p)} Mode
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ArchitectChat: React.FC<ArchitectChatProps> = ({
  isSyncing,
  displayHistory,
  input,
  setInput,
  isTyping,
  onSendMessage,
  className = '',
  onClose,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sync = useNeuralSync();
  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const [showMemoryMonitor, setShowMemoryMonitor] = useState(false);

  const parsedMemory = useMemo(() => {
    try {
      return JSON.parse(sync.conversationMemory || '{"decisions": [], "open_questions": []}');
    } catch (e) {
      return { decisions: [], open_questions: [] };
    }
  }, [sync.conversationMemory]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayHistory.length, isTyping]);

  const lastMsg = displayHistory[displayHistory.length - 1];
  const hasActiveResponse =
    lastMsg?.role === 'model' && (lastMsg.content.length > 0 || lastMsg.kind === 'artifact_ref');

  return (
    <div className={`flex flex-col relative z-10 shrink-0 h-full ${className}`}>
      <div className="p-4 border-b border-white/5 bg-stone-900/60 backdrop-blur-md relative z-20 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-stone-800 rounded-lg text-orange-400">
              <BrainCircuit size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-stone-200 uppercase tracking-widest truncate">
                物語の設計士
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMemoryMonitor(true)}
                  className="flex items-center gap-1.5 text-[8px] font-black text-stone-500 hover:text-orange-400 uppercase tracking-[0.2em] transition-colors"
                >
                  <Activity size={10} /> Memory
                </button>
                <PersonaSelector />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                uiDispatch({ type: 'TOGGLE_CONTEXT_ACTIVE', payload: !ui.isContextActive })
              }
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${ui.isContextActive ? 'border-orange-500/50 text-orange-400 bg-orange-500/10 shadow-lg shadow-orange-950/20' : 'border-stone-800 text-stone-600 hover:border-stone-700'}`}
              title={ui.isContextActive ? '設定を参照中' : '設定を無視中（創造性優先）'}
            >
              <Book size={10} className={ui.isContextActive ? 'animate-pulse' : ''} />
              <span className="hidden md:inline">
                {ui.isContextActive ? 'Bible ON' : 'Bible OFF'}
              </span>
            </button>

            {onClose ? (
              <button
                onClick={onClose}
                className="p-2 bg-stone-800 hover:bg-stone-700 rounded-full text-stone-400 transition-colors"
              >
                <ChevronDown size={16} />
              </button>
            ) : (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${isSyncing ? 'border-orange-500/30 text-orange-400 bg-orange-500/5' : 'border-stone-800 text-stone-600'}`}
              >
                {isSyncing ? <Loader2 size={10} className="animate-spin" /> : <Network size={10} />}
                Sync
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar scroll-smooth"
        ref={scrollRef}
      >
        {displayHistory.map((msg) => {
          if (msg.role === 'model' && !msg.content && msg.kind !== 'artifact_ref') return null;
          return <MessageBubble key={msg.id} msg={msg} />;
        })}

        {isTyping && !hasActiveResponse && (
          <div className="flex items-start gap-2 animate-pulse opacity-50">
            <div className="p-4 glass-bright rounded-2xl rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-stone-500 rounded-full" />
                <div className="w-1.5 h-1.5 bg-stone-500 rounded-full" />
                <div className="w-1.5 h-1.5 bg-stone-500 rounded-full" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-stone-900/80 backdrop-blur border-t border-white/5 flex-shrink-0 relative">
        {/* オフラインオーバーレイ */}
        {!ui.isOnline && (
          <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm z-30 flex items-center justify-center gap-2">
            <WifiOff size={16} className="text-stone-500" />
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
              Offline Mode
            </span>
          </div>
        )}

        <div className="relative group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            placeholder="設計士に相談..."
            disabled={!ui.isOnline}
            className="w-full bg-stone-950/50 border border-stone-800 rounded-xl px-4 py-3 md:py-4 pr-12 text-[13px] text-stone-200 outline-none focus:border-orange-500/30 transition-all resize-none shadow-inner h-12 md:h-14 custom-scrollbar disabled:opacity-30"
          />
          <button
            onClick={onSendMessage}
            disabled={!input.trim() || isTyping || !ui.isOnline}
            className="absolute right-2 bottom-2 md:bottom-3 p-2 bg-stone-800 text-stone-400 rounded-lg hover:bg-orange-600 hover:text-white disabled:opacity-30 transition-all active:scale-95"
          >
            {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        {!ui.isContextActive && ui.isOnline && (
          <p className="text-[8px] font-black text-orange-400/50 uppercase tracking-[0.2em] mt-2 text-center animate-pulse">
            Bible Reference Disabled - High Creativity Mode
          </p>
        )}
      </div>

      {showMemoryMonitor && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm"
            onClick={() => setShowMemoryMonitor(false)}
          />
          <Card
            variant="glass-bright"
            padding="lg"
            className="w-full max-w-sm z-10 space-y-6 shadow-3xl border-orange-500/30"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-600/20 text-orange-400 rounded-lg">
                  <Activity size={18} />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">
                  対話記憶 (Tier 2)
                </h3>
              </div>
              <button
                onClick={() => setShowMemoryMonitor(false)}
                className="text-stone-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="space-y-3">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  <Check size={12} /> 決定事項 (Decisions)
                </div>
                <ul className="space-y-2">
                  {parsedMemory.decisions.length > 0 ? (
                    parsedMemory.decisions.map((d: string, i: number) => (
                      <li
                        key={i}
                        className="text-[11px] text-stone-300 font-serif leading-relaxed p-3 bg-stone-950/50 rounded-xl border border-white/5"
                      >
                        {d}
                      </li>
                    ))
                  ) : (
                    <li className="text-[10px] text-stone-600 italic">決定事項はありません。</li>
                  )}
                </ul>
              </div>
              <div className="space-y-3">
                <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
                  <HelpCircle size={12} /> 検討課題 (Open Questions)
                </div>
                <ul className="space-y-2">
                  {parsedMemory.open_questions.length > 0 ? (
                    parsedMemory.open_questions.map((q: string, i: number) => (
                      <li
                        key={i}
                        className="text-[11px] text-stone-300 font-serif leading-relaxed p-3 bg-stone-950/50 rounded-xl border border-white/5 border-dashed"
                      >
                        {q}
                      </li>
                    ))
                  ) : (
                    <li className="text-[10px] text-stone-600 italic">
                      検討中の課題はありません。
                    </li>
                  )}
                </ul>
              </div>
            </div>
            <p className="text-[9px] text-stone-600 font-serif leading-relaxed italic text-center">
              ※ 会話が増えるとAIが自動で内容を整理し、生の履歴を破棄することで記憶精度を維持します。
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};
