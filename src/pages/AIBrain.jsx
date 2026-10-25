import { useEffect, useRef, useState } from "react";
import { ArrowUp, Brain, FileText, ListTodo, LoaderCircle, Sparkles, UserRound, Bot, Plus, BookOpen, Search, History as HistoryIcon, X, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import Sidebar from "../components/Sidebar";
import API from "../config/api";

const suggestions = [
  { title: "Summarize my notes", prompt: "Summarize the main ideas from my saved notes." },
  { title: "What should I work on?", prompt: "Based on my saved tasks and notes, what should I focus on next?" },
  { title: "Find project details", prompt: "What project details have I saved in my notes?" },
  { title: "Review my priorities", prompt: "Review my saved tasks and identify the highest-priority work." },
];

function readDarkPreference() {
  try {
    const settings = JSON.parse(localStorage.getItem("devflowSettings") || "{}");
    return settings.appearance?.theme === "dark" || settings.theme === "dark" || document.documentElement.classList.contains("app-dark");
  } catch { return document.documentElement.classList.contains("app-dark"); }
}

function AIBrain() {
  const [dark, setDark] = useState(readDarkPreference);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [retrievalMode, setRetrievalMode] = useState("");
  const [conversationId, setConversationId] = useState(() => sessionStorage.getItem("devflow-ai-brain-active-chat-v1") || "");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const initStarted = useRef(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const updateTheme = () => setDark(readDarkPreference());
    window.addEventListener("storage", updateTheme);
    window.addEventListener("devflow:settings-updated", updateTheme);
    return () => {
      window.removeEventListener("storage", updateTheme);
      window.removeEventListener("devflow:settings-updated", updateTheme);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const createConversation = async () => {
    const response = await API.post("/ai/chats");
    const chat = response.data?.conversation;
    if (!chat?._id) throw new Error("The server did not return a chat ID.");
    sessionStorage.setItem("devflow-ai-brain-active-chat-v1", chat._id);
    setConversationId(chat._id);
    setMessages([]);
    setRetrievalMode("");
    return chat._id;
  };

  const loadConversation = async (id) => {
    const response = await API.get(`/ai/chats/${id}`);
    const chat = response.data?.conversation;
    if (!chat?._id) throw new Error("Chat could not be loaded.");
    sessionStorage.setItem("devflow-ai-brain-active-chat-v1", chat._id);
    setConversationId(chat._id);
    setMessages((chat.messages || []).map((message) => ({
      role: message.role, content: message.content, sources: message.sources || [],
    })));
    setRetrievalMode("");
    setHistoryOpen(false);
  };

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;
    const initialize = async () => {
      const activeId = sessionStorage.getItem("devflow-ai-brain-active-chat-v1");
      try {
        if (activeId) {
          const response = await API.get(`/ai/chats/${activeId}`);
          const chat = response.data?.conversation;
          if (chat?._id) {
            // Restore a real conversation, but do not create an empty one on page open.
            setConversationId(chat._id);
            setMessages((chat.messages || []).map((message) => ({
              role: message.role, content: message.content, sources: message.sources || [],
            })));
          } else {
            sessionStorage.removeItem("devflow-ai-brain-active-chat-v1");
            setConversationId("");
            setMessages([]);
          }
        }
      } catch {
        sessionStorage.removeItem("devflow-ai-brain-active-chat-v1");
        setConversationId("");
        setMessages([]);
      } finally {
        setInitializing(false);
      }
    };
    initialize();
  }, []);

  const refreshHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await API.get("/ai/chats");
      setConversations(response.data?.conversations || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load chat history.");
    } finally { setHistoryLoading(false); }
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    await refreshHistory();
  };

  const ask = async (text = question) => {
    const prompt = text.trim();
    if (!prompt || loading || initializing) return;
    let activeId = conversationId || sessionStorage.getItem("devflow-ai-brain-active-chat-v1");
    if (!activeId) {
      try { activeId = await createConversation(); }
      catch { toast.error("Could not start a new chat."); return; }
    }
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setQuestion("");
    setLoading(true);
    try {
      const response = await API.post("/ai/brain", { question: prompt, messages: history, conversationId: activeId });
      const data = response.data;
      setRetrievalMode(data.retrievalMode || "");
      setMessages((current) => [...current, {
        role: "assistant",
        content: data.answer || "I couldn't generate an answer. Please try again.",
        sources: Array.isArray(data.sources) ? data.sources : [],
      }]);
    } catch (error) {
      const message = error.response?.data?.message || "Could not reach AI Brain. Check that the backend is running and your session is active.";
      toast.error(message);
      setMessages((current) => [...current, { role: "assistant", content: `I couldn't complete that request. ${message}`, sources: [] }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const startNewChat = () => {
    if (loading) return;
    // A blank chat is only a local draft. Persist it after the user sends a message.
    sessionStorage.removeItem("devflow-ai-brain-active-chat-v1");
    setConversationId("");
    setMessages([]);
    setQuestion("");
    setRetrievalMode("");
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const deleteConversation = async (event, id) => {
    event.stopPropagation();
    try {
      await API.delete(`/ai/chats/${id}`);
      setConversations((current) => current.filter((chat) => chat._id !== id));
      if (id === conversationId) {
        sessionStorage.removeItem("devflow-ai-brain-active-chat-v1");
        setConversationId("");
        setMessages([]);
        setRetrievalMode("");
      }
      toast.success("Chat deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete chat.");
    }
  };
  const shell = dark ? "bg-[#0b1120] text-slate-100" : "bg-slate-50 text-slate-900";
  const panel = dark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white";
  const muted = dark ? "text-slate-400" : "text-slate-500";

  return (
    <div className={`flex h-screen min-h-[620px] overflow-hidden ${shell}`}>
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className={`flex items-center justify-between border-b px-5 py-4 sm:px-8 ${dark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-white"}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/20"><Brain size={23} /></div>
            <div className="min-w-0"><h1 className="text-lg font-bold sm:text-xl">DevFlow AI Brain</h1><p className={`text-xs sm:text-sm ${muted}`}>Answers grounded in your saved notes and tasks</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={openHistory} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-100"}`} title="Chat history"><HistoryIcon size={16} /><span className="hidden sm:inline">History</span></button>
            <button onClick={startNewChat} disabled={initializing || loading} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-100"}`}><Plus size={16} /><span className="hidden sm:inline">New chat</span></button>
          </div>
        </header>

        <section ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-4xl">
            {initializing ? (
              <div className={`flex min-h-64 items-center justify-center gap-2 text-sm ${muted}`}><LoaderCircle size={18} className="animate-spin" />Restoring your current chat…</div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-full flex-col justify-center py-8 sm:py-12">
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-500 text-white shadow-xl shadow-indigo-500/20"><Sparkles size={30} /></div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Your workspace, understood.</h2>
                  <p className={`mx-auto mt-3 max-w-xl text-sm leading-6 sm:text-base ${muted}`}>Ask questions about your notes and tasks. AI Brain retrieves relevant saved content and shows the sources used for its answer.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {suggestions.map((item) => <button key={item.title} onClick={() => ask(item.prompt)} className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${panel} ${dark ? "hover:border-indigo-500" : "hover:border-indigo-300 hover:shadow-md"}`}><span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500"><BookOpen size={18} /></span><span className="block font-semibold">{item.title}</span><span className={`mt-1 block text-sm leading-5 ${muted}`}>{item.prompt}</span></button>)}
                </div>
                <div className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${dark ? "border-slate-800 bg-slate-900/60" : "border-indigo-100 bg-indigo-50/70"}`}><Search size={18} className="mt-0.5 shrink-0 text-indigo-500" /><p className={muted}>For best results, add useful text to your notes and keep task titles/descriptions specific. Attached files are not yet indexed by AI Brain.</p></div>
              </div>
            ) : (
              <div className="space-y-7 pb-8">
                {messages.map((message, index) => <article key={`${index}-${message.role}`} className="flex gap-3 sm:gap-4">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${message.role === "assistant" ? "bg-gradient-to-br from-violet-600 to-indigo-500 text-white" : dark ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-700"}`}>{message.role === "assistant" ? <Bot size={19} /> : <UserRound size={18} />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-sm font-semibold">{message.role === "assistant" ? "AI Brain" : "You"}</p>
                    <div className={`whitespace-pre-wrap break-words text-sm leading-7 sm:text-[15px] ${message.role === "assistant" ? (dark ? "text-slate-200" : "text-slate-700") : (dark ? "text-slate-100" : "text-slate-900")}`}>{message.content}</div>
                    {message.sources?.length > 0 && <div className="mt-4"><p className={`mb-2 text-xs font-bold uppercase tracking-wider ${muted}`}>Sources used</p><div className="grid gap-2 sm:grid-cols-2">{message.sources.map((source) => <div key={`${source.type}-${source.id}-${source.sourceNumber}`} className={`rounded-xl border p-3 ${dark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}><div className="flex items-start gap-2"><span className="mt-0.5 text-indigo-500">{source.type === "task" ? <ListTodo size={16} /> : <FileText size={16} />}</span><div className="min-w-0"><p className="text-sm font-semibold">[Source {source.sourceNumber}] {source.title}</p><p className={`mt-1 line-clamp-3 text-xs leading-5 ${muted}`}>{source.excerpt}</p><span className={`mt-2 inline-block text-[10px] uppercase tracking-wider ${muted}`}>{source.type}</span></div></div></div>)}</div></div>}
                  </div>
                </article>)}
                {loading && <div className="flex gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 text-white"><Bot size={19} /></div><div className={`flex items-center gap-2 text-sm ${muted}`}><LoaderCircle size={16} className="animate-spin" />Searching your workspace and preparing an answer…</div></div>}
              </div>
            )}
          </div>
        </section>

        <footer className={`border-t px-4 py-4 sm:px-8 ${dark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-white"}`}>
          <div className="mx-auto max-w-4xl">
            {retrievalMode && <p className={`mb-2 text-[11px] ${muted}`}>Retrieval: {retrievalMode}</p>}
            <form onSubmit={(event) => { event.preventDefault(); ask(); }} className={`flex items-end gap-2 rounded-2xl border p-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 ${dark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
              <textarea ref={inputRef} rows={1} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(); } }} placeholder="Ask about your notes or tasks…" maxLength={4000} className={`max-h-36 min-h-11 flex-1 resize-y bg-transparent px-3 py-3 text-sm outline-none ${dark ? "text-slate-100 placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"}`} />
              <button type="submit" disabled={!question.trim() || loading || initializing} aria-label="Send question" className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={20} /></button>
            </form>
            <p className={`mt-2 text-center text-[11px] ${muted}`}>AI can make mistakes. Check the cited notes for important details.</p>
          </div>
        </footer>
      </main>

      {historyOpen && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}>
        <aside className={`flex h-full w-full max-w-md flex-col border-l shadow-2xl ${dark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}>
          <div className={`flex items-center justify-between border-b px-5 py-4 ${dark ? "border-slate-800" : "border-slate-200"}`}>
            <div><h2 className="text-lg font-bold">Chat history</h2><p className={`mt-1 text-xs ${muted}`}>Your saved AI Brain conversations</p></div>
            <button onClick={() => setHistoryOpen(false)} aria-label="Close history" className={`rounded-lg p-2 ${dark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}><X size={19} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {historyLoading ? <div className={`py-10 text-center text-sm ${muted}`}>Loading chats…</div> : conversations.length === 0 ? <div className={`py-12 text-center text-sm ${muted}`}><MessageSquare size={28} className="mx-auto mb-3 opacity-50" />No saved chats yet.</div> : <div className="space-y-2">
              {conversations.map((chat) => <div key={chat._id} className={`group flex items-start gap-2 rounded-xl border p-3 ${chat._id === conversationId ? (dark ? "border-indigo-500 bg-indigo-500/10" : "border-indigo-300 bg-indigo-50") : (dark ? "border-slate-800 hover:bg-slate-900" : "border-slate-200 hover:bg-slate-50")}`}>
                <button onClick={() => loadConversation(chat._id).catch((error) => toast.error(error.response?.data?.message || "Could not open this chat."))} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold">{chat.title || "New chat"}</span>
                  <span className={`mt-1 block truncate text-xs ${muted}`}>{chat.preview || "No messages yet"}</span>
                  <span className={`mt-2 block text-[10px] ${muted}`}>{chat.messageCount || 0} messages · {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleString() : ""}</span>
                </button>
                <button onClick={(event) => deleteConversation(event, chat._id)} title="Delete chat" aria-label="Delete chat" className="rounded-lg p-2 text-slate-400 transition hover:bg-red-500/10 hover:text-red-500"><Trash2 size={16} /></button>
              </div>)}
            </div>}
          </div>
          <div className={`border-t p-4 ${dark ? "border-slate-800" : "border-slate-200"}`}>
            <button onClick={refreshHistory} className={`mr-2 rounded-xl border px-3 py-2 text-sm ${dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-100"}`}>Refresh</button>
            <button onClick={startNewChat} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"><Plus size={15} className="mr-1 inline" />New chat</button>
          </div>
        </aside>
      </div>}
    </div>
  );
}

export default AIBrain;
