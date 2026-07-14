import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  IconX, IconCode, IconChevronDown, IconHistory, IconMessageCircle,
  IconChevronUp, IconRestore,
} from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useActions } from '@/context/ActionsContext';
import { fetchActionHistory, type ActionVersion } from '@/lib/actions-agent';
import { highlightPython, CopyButton, diffLines } from '@/lib/highlight';
import { ChatPanel } from '@/components/ChatWidget';

const ORIGIN_LABELS: Record<string, string> = {
  fix: 'Auto-Fix',
  chat: 'Chat',
  initial: 'Erstellt',
  revert: 'Wiederhergestellt',
};

function formatDateTime(d?: string) {
  if (!d) return '';
  try { return format(parseISO(d), 'dd.MM.yyyy, HH:mm', { locale: de }); } catch { return d; }
}

// Timeline label: the agent's own summary, or a localized fallback for
// revert/initial entries (their summaries are stored empty on purpose)
function versionSummary(v: ActionVersion): string {
  if (v.summary) return v.summary;
  if (v.origin === 'revert' && v.revert_of) return `Zurückgesetzt auf Version ${v.revert_of}`;
  return ORIGIN_LABELS[v.origin] || '';
}

function VersionEntry({ version, current, selected, onSelect }: {
  version: ActionVersion;
  current: number;
  selected: boolean;
  onSelect: (v: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(version.v)}
      aria-current={selected}
      className={`relative w-full rounded-xl px-3 py-2.5 text-left flex flex-col gap-0.5 transition-colors min-h-[2.75rem] ${
        selected ? 'bg-secondary' : 'hover:bg-muted'
      }`}
    >
      {selected && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-primary" />}
      <span className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-bold tabular-nums">v{version.v}</span>
        <span className="rounded-full border border-border bg-card px-1.5 py-px text-[10px] font-medium text-muted-foreground">
          {ORIGIN_LABELS[version.origin] || version.origin}
        </span>
        {version.v === current && (
          <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-700">
            Aktiv
          </span>
        )}
      </span>
      {versionSummary(version) && (
        <span className="text-xs leading-snug text-foreground">{versionSummary(version)}</span>
      )}
      <span className="text-[11px] text-muted-foreground tabular-nums">{formatDateTime(version.ts)}</span>
    </button>
  );
}

export function ActionCodeDrawer() {
  const { codeDrawerAction: action, codeDrawerFocus, closeCodeDrawer, revertActionVersion, chatLoading } = useActions();

  const [versions, setVersions] = useState<ActionVersion[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<'code' | 'diff'>('code');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Load history when the drawer opens (or is retargeted to a version)
  useEffect(() => {
    if (!action) return;
    let cancelled = false;
    setVersions(null);
    setCurrent(action.current_version);
    setSelected(codeDrawerFocus?.version ?? action.current_version);
    setTab(codeDrawerFocus?.tab ?? 'code');
    setPickerOpen(false);
    void fetchActionHistory(action.app_id, action.identifier).then(h => {
      if (cancelled) return;
      setVersions(h.versions);
      setCurrent(h.current);
      if (!codeDrawerFocus) setSelected(h.current);
    });
    return () => { cancelled = true; };
  }, [action, codeDrawerFocus]);

  // The agent (or a revert) saved a new version while the drawer is open:
  // reload the history and jump to the new version's diff (live update)
  useEffect(() => {
    if (!action) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { appId: string; identifier: string; version: number };
      if (detail.appId !== action.app_id || detail.identifier !== action.identifier) return;
      void fetchActionHistory(action.app_id, action.identifier).then(h => {
        setVersions(h.versions);
        setCurrent(h.current);
        setSelected(detail.version);
        setTab('diff');
      });
    };
    window.addEventListener('action-code-changed', handler);
    return () => window.removeEventListener('action-code-changed', handler);
  }, [action]);

  // While the agent works, surface the conversation in the dock
  useEffect(() => {
    if (chatLoading) setDockOpen(true);
  }, [chatLoading]);

  useEffect(() => {
    if (!action) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCodeDrawer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [action, closeCodeDrawer]);

  const sorted = useMemo(
    () => (versions ? [...versions].sort((a, b) => a.v - b.v) : []),
    [versions],
  );
  const newestFirst = useMemo(() => [...sorted].reverse(), [sorted]);
  const selectedEntry = sorted.find(v => v.v === selected) ?? null;
  const selectedIdx = selectedEntry ? sorted.indexOf(selectedEntry) : -1;
  const prevEntry = selectedIdx > 0 ? sorted[selectedIdx - 1] : null;

  // Fallback to the action's live code when there is no history (yet)
  const code = selectedEntry ? selectedEntry.code : (action?.value ?? '');
  const codeLines = useMemo(() => (code ? code.split('\n') : ['# Leere Aktion']), [code]);
  const diffOps = useMemo(
    () => (prevEntry ? diffLines(prevEntry.code.split('\n'), codeLines) : null),
    [prevEntry, codeLines],
  );

  const isOld = selectedEntry !== null && selected !== current;

  const handleSelect = useCallback((v: number) => {
    setSelected(v);
    setPickerOpen(false);
  }, []);

  const handleRestore = useCallback(async () => {
    if (!action || !selectedEntry) return;
    const ok = window.confirm(`Version wiederherstellen v${selectedEntry.v}?\n\nDer aktuelle Code wird ersetzt. Nichts geht verloren — es entsteht eine neue Version.`);
    if (!ok) return;
    setRestoring(true);
    try {
      await revertActionVersion(action.app_id, action.identifier, selectedEntry.v, current);
    } finally {
      setRestoring(false);
    }
  }, [action, selectedEntry, current, revertActionVersion]);

  if (!action) return null;

  const title = action.title || action.identifier;

  // Portal: `position: fixed` must anchor to the viewport, not a transformed
  // ancestor (same reasoning as ActionsDrawer)
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[var(--z-overlay)] bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={closeCodeDrawer}
      />
      <aside
        role="dialog"
        aria-label={title}
        className="fixed top-0 right-0 z-[var(--z-overlay)] h-full w-full sm:max-w-xl lg:max-w-3xl bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <header className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b shrink-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <IconCode size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold tracking-tight truncate">{title}</h2>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              <span className="font-mono bg-muted rounded px-1 py-px">{action.identifier}</span>
              <span className="ml-2">{action.app_name}</span>
            </p>
          </div>
          <CopyButton text={code} />
          <button
            type="button"
            onClick={closeCodeDrawer}
            className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Schließen"
          >
            <IconX size={18} />
          </button>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Version timeline — rail on large screens */}
          <nav aria-label="Versionen" className="hidden lg:flex w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border px-3 py-3">
            <div className="px-2 pb-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              Versionen
            </div>
            {versions !== null && newestFirst.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">Keine früheren Versionen</p>
            )}
            {newestFirst.map(v => (
              <VersionEntry key={v.v} version={v} current={current} selected={v.v === selected} onSelect={handleSelect} />
            ))}
          </nav>

          {/* Code pane */}
          <div className="flex flex-1 min-w-0 flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 shrink-0">
              {/* Version picker on small screens */}
              {newestFirst.length > 0 && (
                <div className="relative lg:hidden">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(o => !o)}
                    className="inline-flex min-h-[2.5rem] items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold hover:bg-muted transition-colors"
                  >
                    <IconHistory size={14} />
                    v{selected}
                    <IconChevronDown size={14} className={`transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {pickerOpen && (
                    <div className="absolute left-0 top-full z-10 mt-1 flex max-h-72 w-72 max-w-[78vw] flex-col gap-0.5 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
                      {newestFirst.map(v => (
                        <VersionEntry key={v.v} version={v} current={current} selected={v.v === selected} onSelect={handleSelect} />
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'code'}
                onClick={() => setTab('code')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === 'code' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
              >
                Code
              </button>
              {prevEntry && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'diff'}
                  onClick={() => setTab('diff')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === 'diff' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
                >
                  Änderungen zu v{prevEntry.v}
                </button>
              )}
            </div>

            {/* Not-the-active-version banner */}
            {isOld && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary px-3 py-2 text-xs shrink-0">
                <span>
                  Du siehst <b>v{selected}</b> ({formatDateTime(selectedEntry?.ts)}) — nicht die aktive Version.
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  disabled={restoring || chatLoading}
                  onClick={() => { void handleRestore(); }}
                  className="inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <IconRestore size={14} />
                  Diese Version wiederherstellen
                </button>
              </div>
            )}

            {/* Code / diff */}
            <div className="flex-1 min-h-0 overflow-auto bg-muted/20 py-2 font-mono text-xs leading-relaxed">
              {tab === 'diff' && diffOps ? (
                diffOps.map((op, i) => (
                  <div
                    key={i}
                    className={`flex ${op.t === '+' ? 'bg-emerald-100/60' : op.t === '-' ? 'bg-red-100/60' : ''}`}
                  >
                    <span className={`w-11 shrink-0 select-none pr-3 text-right tabular-nums ${op.t === '+' ? 'text-emerald-700' : op.t === '-' ? 'text-red-600' : 'text-muted-foreground/50'}`}>
                      {op.t === '-' ? '−' : op.no}
                    </span>
                    <span className={`whitespace-pre pr-6 ${op.t === '-' ? 'text-red-600' : ''}`}>
                      {op.t === '-' ? op.line || ' ' : highlightPython(op.line || ' ')}
                    </span>
                  </div>
                ))
              ) : (
                codeLines.map((line, i) => (
                  <div key={i} className="flex">
                    <span className="w-11 shrink-0 select-none pr-3 text-right tabular-nums text-muted-foreground/50">{i + 1}</span>
                    <span className="whitespace-pre pr-6">{highlightPython(line || ' ')}</span>
                  </div>
                ))
              )}
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-3 border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground tabular-nums shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>v{selectedEntry?.v ?? current}{isOld ? '' : ` · Aktiv`}</span>
              {selectedEntry && <span>{ORIGIN_LABELS[selectedEntry.origin] || selectedEntry.origin}</span>}
              {selectedEntry && <span>{formatDateTime(selectedEntry.ts)}</span>}
              <span>{codeLines.length} Zeilen</span>
            </div>
          </div>
        </div>

        {/* Chat dock — the SAME conversation as the floating chat widget */}
        <div className={`shrink-0 border-t border-border bg-card flex flex-col ${dockOpen ? 'h-[45dvh] min-h-[15rem]' : ''}`}>
          <button
            type="button"
            onClick={() => setDockOpen(o => !o)}
            className="flex min-h-[2.25rem] items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-expanded={dockOpen}
          >
            <IconMessageCircle size={14} />
            Assistent
            {dockOpen ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
          </button>
          <ChatPanel placeholder="Frage zum Code stellen…" collapsed={!dockOpen} />
        </div>
      </aside>
    </>,
    document.body
  );
}
