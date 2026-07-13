import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import type { Action, FileAttachment } from '@/lib/actions-agent';
import { fetchActionsAndFiles, executeAction, deleteAction as deleteActionApi, deleteAppAttachment as deleteAppAttachmentApi, agentChat, fixAction, downloadFile } from '@/lib/actions-agent';

export type ExecErrorContext = {
  actionName: string;
  actionIdentifier: string;
  appId: string;
  errorText: string;
  stdout?: string;
  inputs?: Record<string, unknown>;
  files?: File[];
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  // Original filename of the attached file — the agent stages uploads
  // under this name instead of a generated upload_NN.ext.
  imageName?: string;
  // 'action' = auto-generated invocation notice (Aktion: …), styled as a
  // neutral system event instead of a primary user bubble.
  kind?: 'action';
  fixContext?: ExecErrorContext;
};

interface ActionsContextType {
  actions: Action[];
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  messages: Message[];
  chatLoading: boolean;
  runAction: (action: Action) => void;
  sendMessage: (text: string, image?: string, imageName?: string) => void;
  fixError: (messageId: string) => void;
  fixingMessageId: string | null;
  runningActionId: string | null;
  devMode: boolean;
  setDevMode: (v: boolean) => void;
  betaMode: boolean;
  setBetaMode: (v: boolean) => void;
  showActionCode: (action: Action) => void;
  deleteAction: (action: Action) => Promise<void>;
  inputFormAction: Action | null;
  inputFormOptions: Record<string, Array<{ value: string; label: string }>> | null;
  submitActionInputs: (action: Action, inputs: Record<string, unknown>, files: File[]) => void;
  cancelInputForm: () => void;
  files: FileAttachment[];
  filesByAction: Record<string, FileAttachment[]>;
  downloadFile: (url: string, filename: string) => Promise<void>;
  deleteAppAttachment: (file: FileAttachment) => Promise<void>;
}

const ActionsContext = createContext<ActionsContextType | null>(null);

function readChannelCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some(c => c === 'channel=beta');
}

function writeChannelCookie(beta: boolean): void {
  const value = beta ? 'beta' : 'stable';
  document.cookie = `channel=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

function execErrorUpdate(
  action: Action,
  errorText: string,
  stdout?: string | null,
  inputs?: Record<string, unknown>,
  files?: File[],
): Pick<Message, 'content' | 'fixContext'> {
  const name = action.title || action.identifier;
  return {
    content: `**Etwas klappte nicht bei der Ausführung von \`${name}\`:**\n\`\`\`\n${errorText}\n\`\`\``,
    fixContext: {
      actionName: name,
      actionIdentifier: action.identifier,
      appId: action.app_id,
      errorText,
      stdout: stdout || undefined,
      inputs,
      files,
    },
  };
}

export function useActions() {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('useActions must be used within ActionsProvider');
  return ctx;
}

export function ActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());
  const [fixingMessageId, setFixingMessageId] = useState<string | null>(null);
  const chatLoadingRef = useRef(false);
  const [inputFormAction, setInputFormAction] = useState<Action | null>(null);
  const [inputFormOptions, setInputFormOptions] = useState<
    Record<string, Array<{ value: string; label: string }>> | null
  >(null);

  const filesByAction = useMemo(() => {
    const map: Record<string, FileAttachment[]> = {};
    for (const f of files) {
      const key = f.action_identifier || '__unassigned__';
      (map[key] ??= []).push(f);
    }
    return map;
  }, [files]);

  const [devMode, setDevMode] = useState(() => {
    try { return localStorage.getItem('developer-mode') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('developer-mode', String(devMode)); } catch {}
  }, [devMode]);

  const [betaMode, setBetaModeState] = useState(() => {
    try { return readChannelCookie(); } catch { return false; }
  });

  const setBetaMode = useCallback((v: boolean) => {
    setBetaModeState(v);
    try { writeChannelCookie(v); } catch {}
  }, []);

  const refreshActions = useCallback(async () => {
    try {
      const result = await fetchActionsAndFiles();
      setActions(result.actions);
      setFiles(result.files);
    } catch {
      // silently ignore — actions panel will be empty
    }
  }, []);

  useEffect(() => {
    void refreshActions();
  }, [refreshActions]);

  // On execution errors the Werkzeug UI must give way to the chat, where the
  // exception and the auto-fix button live. The drawer owns its own open
  // state, so it listens for this event (same idiom as 'dashboard-refresh').
  const focusChatOnError = useCallback(() => {
    window.dispatchEvent(new Event('actions-drawer-close'));
    setChatOpen(true);
  }, []);

  const executeAndReport = useCallback((action: Action, inputs?: Record<string, unknown>, files?: File[]) => {
    if (chatLoadingRef.current) return;
    chatLoadingRef.current = true;
    setChatLoading(true);
    setRunningActionId(action.identifier);
    setChatOpen(true);

    const placeholderId = crypto.randomUUID();
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', kind: 'action', content: `Aktion: ${action.identifier}` },
      { id: placeholderId, role: 'assistant', content: 'In Arbeit...' },
    ]);

    executeAction(action.app_id, action.identifier, inputs, files)
      .then(result => {
        if (result.error) focusChatOnError();
        setMessages(prev =>
          prev.map(m => m.id === placeholderId
            ? { ...m, ...(result.error
                ? execErrorUpdate(action, result.error, result.stdout, inputs, files)
                : { content: result.stdout || '(no output)' }) }
            : m)
        );
      })
      .catch(err => {
        focusChatOnError();
        setMessages(prev =>
          prev.map(m =>
            m.id === placeholderId
              ? { ...m, content: `Fehler bei der Ausführung: ${err instanceof Error ? err.message : String(err)}` }
              : m,
          )
        );
      })
      .finally(() => {
        chatLoadingRef.current = false;
        setChatLoading(false);
        setRunningActionId(null);
        void refreshActions();
        window.dispatchEvent(new Event('dashboard-refresh'));
      });
  }, [refreshActions, focusChatOnError]);

  const runAction = useCallback((action: Action) => {
    const schema = action.metadata?.input_schema;
    if (!schema?.properties || Object.keys(schema.properties).length === 0) {
      executeAndReport(action);
      return;
    }

    if (schema['x-preflight']) {
      // Two-phase: run preflight to get dynamic options
      if (chatLoadingRef.current) return;
      chatLoadingRef.current = true;
      setChatLoading(true);
      setRunningActionId(action.identifier);
      setChatOpen(true);

      const placeholderId = crypto.randomUUID();
      setMessages(prev => [
        ...prev,
        { id: placeholderId, role: 'assistant', content: 'Wird vorbereitet...' },
      ]);

      executeAction(action.app_id, action.identifier, {})
        .then(result => {
          setMessages(prev => prev.filter(m => m.id !== placeholderId));

          if (result.error) {
            setRunningActionId(null);
            focusChatOnError();
            setMessages(prev => [
              ...prev,
              { id: crypto.randomUUID(), role: 'assistant', ...execErrorUpdate(action, result.error ?? '', result.stdout) },
            ]);
            return;
          }

          let options: Record<string, Array<{ value: string; label: string }>> | null = null;
          try {
            const parsed = JSON.parse(result.stdout || '');
            if (parsed._options && typeof parsed._options === 'object') {
              options = parsed._options;
            }
          } catch { /* not JSON — fall back to schema-only form */ }

          setInputFormOptions(options);
          setInputFormAction(action);
        })
        .catch(err => {
          setRunningActionId(null);
          focusChatOnError();
          setMessages(prev => prev.filter(m => m.id !== placeholderId));
          setMessages(prev => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', content: `Fehler bei der Ausführung: ${err instanceof Error ? err.message : String(err)}` },
          ]);
        })
        .finally(() => {
          chatLoadingRef.current = false;
          setChatLoading(false);
        });
      return;
    }

    // No preflight: show form immediately
    setInputFormOptions(null);
    setInputFormAction(action);
  }, [executeAndReport, focusChatOnError]);

  const submitActionInputs = useCallback((action: Action, inputs: Record<string, unknown>, files: File[]) => {
    setInputFormAction(null);
    setInputFormOptions(null);
    executeAndReport(action, inputs, files.length > 0 ? files : undefined);
  }, [executeAndReport]);

  const cancelInputForm = useCallback(() => {
    setInputFormAction(null);
    setInputFormOptions(null);
    setRunningActionId(null);
  }, []);

  const showActionCode = useCallback((action: Action) => {
    const code = action.value.trim() || '# Leere Aktion';
    const msg = `**Code für \`${action.identifier}\` in \`${action.app_name}\`:**\n\n\`\`\`python\n${code}\n\`\`\``;
    setChatOpen(true);
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', content: msg },
    ]);
  }, []);

  const deleteActionFn = useCallback(async (action: Action) => {
    const confirmed = window.confirm(`Aktion löschen "${action.identifier}" (aus "${action.app_name}")?`);
    if (!confirmed) return;
    const result = await deleteActionApi(action.app_id, action.identifier);
    setChatOpen(true);
    if (result.error) {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `**Fehler bei der Ausführung:** ${result.error}` },
      ]);
    } else {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Aktion gelöscht: \`${action.identifier}\` (aus \`${action.app_name}\`).` },
      ]);
      await refreshActions();
    }
  }, [refreshActions]);

  const deleteAppAttachmentFn = useCallback(async (file: FileAttachment) => {
    const confirmed = window.confirm(`Datei löschen "${file.filename}"?`);
    if (!confirmed) return;
    const result = await deleteAppAttachmentApi(file.app_id, file.identifier);
    if (result.error) {
      setChatOpen(true);
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `**Fehler bei der Ausführung:** ${result.error}` },
      ]);
    } else {
      await refreshActions();
    }
  }, [refreshActions]);

  const releaseFixContexts = useCallback((appId: string, actionIdentifier: string) => {
    setMessages(prev =>
      prev.map(m =>
        m.fixContext && m.fixContext.appId === appId && m.fixContext.actionIdentifier === actionIdentifier
          ? { ...m, fixContext: undefined }
          : m,
      )
    );
  }, []);

  const sendMessage = useCallback(async (text: string, image?: string, imageName?: string) => {
    if (chatLoadingRef.current) return;
    chatLoadingRef.current = true;
    setChatLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      image: image ?? undefined,
      imageName: image ? imageName ?? undefined : undefined,
    };
    const assistantId = crypto.randomUUID();

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '' },
    ]);

    try {
      const apiMessages = messages
        .concat(userMsg)
        .map(m => ({ role: m.role, content: m.content, image: m.image, imageName: m.imageName }));

      await agentChat(apiMessages, threadId, (delta) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + delta } : m,
          )
        );
      }, (fixResult) => {
        // A fix pending on this thread verified during the chat turn.
        if (fixResult.success) releaseFixContexts(fixResult.appId, fixResult.action);
      });
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `Fehler bei der Ausführung: ${err instanceof Error ? err.message : String(err)}` }
            : m,
        )
      );
    } finally {
      chatLoadingRef.current = false;
      setChatLoading(false);
      void refreshActions();
      window.dispatchEvent(new Event('dashboard-refresh'));
    }
  }, [messages, threadId, refreshActions, releaseFixContexts]);

  const fixError = useCallback(async (messageId: string) => {
    const ctx = messages.find(m => m.id === messageId)?.fixContext;
    if (!ctx || chatLoadingRef.current) return;
    chatLoadingRef.current = true;
    setChatLoading(true);
    setFixingMessageId(messageId);

    // Fresh thread: the fix conversation replaces the current chat session,
    // so follow-up questions from the fix agent continue on the same thread.
    const fixThreadId = crypto.randomUUID();
    setThreadId(fixThreadId);
    const answerId = crypto.randomUUID();
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Korrektur für \`${ctx.actionName}\`** — neue Chat-Sitzung für diese Korrektur gestartet.\n\`\`\`\n${ctx.errorText}\n\`\`\``,
      },
      { id: answerId, role: 'assistant', content: '' },
    ]);

    let answerText = '';
    try {
      const result = await fixAction(
        {
          appId: ctx.appId,
          actionIdentifier: ctx.actionIdentifier,
          threadId: fixThreadId,
          error: ctx.errorText,
          stdout: ctx.stdout,
          inputs: ctx.inputs,
          files: ctx.files,
        },
        (content) => {
          answerText += content;
          setMessages(prev =>
            prev.map(m => m.id === answerId ? { ...m, content: m.content + content } : m)
          );
        },
      );
      if (result?.success) {
        // The agent's verified replay WAS the execution — nothing to re-run.
        void refreshActions();
        window.dispatchEvent(new Event('dashboard-refresh'));
      } else {
        // The status note goes BEFORE the agent's answer so a clarifying
        // question stays last and visible; the Auto-Fix button re-arms on
        // the answer itself (or on the note when the stream stayed empty).
        const note: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result?.error
            ? `**Die Aktion schlägt weiterhin fehl:**\n\`\`\`\n${result.error}\n\`\`\``
            : '*Die Korrektur ist noch nicht bestätigt — deine ursprüngliche Eingabe bleibt erhalten.*',
          ...(answerText ? {} : { fixContext: ctx }),
        };
        setMessages(prev => {
          const armed = answerText
            ? prev.map(m => m.id === answerId ? { ...m, fixContext: ctx } : m)
            : prev;
          const idx = armed.findIndex(m => m.id === answerId);
          const at = idx === -1 ? armed.length : idx;
          return [...armed.slice(0, at), note, ...armed.slice(at)];
        });
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `**Korrektur-Anfrage fehlgeschlagen:** ${err instanceof Error ? err.message : String(err)}\n\n*Deine ursprüngliche Eingabe bleibt erhalten — du kannst es erneut versuchen.*`,
          fixContext: ctx,
        },
      ]);
    } finally {
      setFixingMessageId(null);
      chatLoadingRef.current = false;
      setChatLoading(false);
    }
  }, [messages, refreshActions]);

  return (
    <ActionsContext.Provider
      value={{ actions, chatOpen, setChatOpen, messages, chatLoading, runningActionId, runAction, sendMessage, fixError, fixingMessageId, devMode, setDevMode, betaMode, setBetaMode, showActionCode, deleteAction: deleteActionFn, inputFormAction, inputFormOptions, submitActionInputs, cancelInputForm, files, filesByAction, downloadFile, deleteAppAttachment: deleteAppAttachmentFn }}
    >
      {children}
    </ActionsContext.Provider>
  );
}
