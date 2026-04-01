import React, { useMemo, useState } from 'react';
import { BranchValidationIssue } from '../../services/scenePackage';

interface BranchIssuesPanelProps {
  issues: BranchValidationIssue[];
  chapterIssues: Array<{ level: 'error' | 'warning'; message: string; sceneId?: string }>;
}

export const BranchIssuesPanel: React.FC<BranchIssuesPanelProps> = ({ issues, chapterIssues }) => {
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [query, setQuery] = useState('');

  const merged = [
    ...issues.map((issue) => ({
      level: issue.level,
      message: issue.message,
      scope: [issue.chapterId, issue.sceneId, issue.choiceId].filter(Boolean).join(' / '),
    })),
    ...chapterIssues.map((issue) => ({
      level: issue.level,
      message: issue.message,
      scope: issue.sceneId || 'chapter',
    })),
  ];

  const filtered = useMemo(
    () =>
      merged.filter((issue) => {
        if (levelFilter !== 'all' && issue.level !== levelFilter) return false;
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return issue.message.toLowerCase().includes(q) || issue.scope.toLowerCase().includes(q);
      }),
    [merged, levelFilter, query],
  );

  const grouped = useMemo(() => {
    const bucket: Record<string, typeof filtered> = {};
    for (const issue of filtered) {
      const key = issue.scope || 'project';
      if (!bucket[key]) bucket[key] = [];
      bucket[key].push(issue);
    }
    return bucket;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full bg-stone-900/40">
      <div className="p-4 border-b border-white/5">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">
          Branch Issues
        </p>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as 'all' | 'error' | 'warning')}
            className="bg-stone-950 border border-white/10 rounded px-2 py-1 text-xs text-stone-300"
          >
            <option value="all">All</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues"
            className="flex-1 bg-stone-950 border border-white/10 rounded px-2 py-1 text-xs text-stone-300"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 && (
          <p className="text-xs text-emerald-400">問題は検出されませんでした。</p>
        )}
        {Object.entries(grouped).map(([scope, scopedIssues]) => (
          <div key={scope} className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-stone-500">{scope}</p>
            {scopedIssues.map((issue, idx) => (
              <div
                key={`${scope}-${idx}`}
                className={`p-3 rounded-xl border ${issue.level === 'error' ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}
              >
                <p
                  className={`text-xs ${issue.level === 'error' ? 'text-rose-300' : 'text-amber-300'}`}
                >
                  {issue.message}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
