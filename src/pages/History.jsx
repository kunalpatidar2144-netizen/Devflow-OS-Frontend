import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Pin, PinOff, Trash2, Bot, FileText, Brain, Clock3, ArrowLeft, CheckCircle2, XCircle, History as HistoryIcon, Activity } from "lucide-react";
import { toast } from "sonner";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { getHistory, updateHistory, deleteHistory } from "../services/historyService";

const typeLabels = { assistant: "AI Assistant", summary: "AI Summary", quiz: "AI Quiz Result", note_activity: "Note Activity" };
const typeIcons = { assistant: Bot, summary: FileText, quiz: Brain, note_activity: Activity };

function History() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState(() => searchParams.get("type") || "all");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getHistory({
        pinned: pinnedOnly ? "true" : undefined,
        search: search.trim() || undefined, from: from || undefined, to: to || undefined,
      });
      setItems(response.data.items || []);
      setSelected((current) => current ? (response.data.items || []).find((x) => x._id === current._id) || null : null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load history");
    } finally { setLoading(false); }
  }, [type, pinnedOnly, search, from, to]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const queryType = searchParams.get("type") || "all";
    if (["all", "assistant", "summary", "quiz", "note_activity"].includes(queryType)) {
      setType(queryType);
    }
  }, [searchParams]);

  const chooseHistoryType = (value) => {
    setType(value);
    if (value === "all") setSearchParams({});
    else setSearchParams({ type: value });
  };

  const visibleItems = useMemo(
    () => type === "all" ? items : items.filter((item) => item.type === type),
    [items, type]
  );

  const counts = useMemo(() => ({
    all: items.length,
    assistant: items.filter((x) => x.type === "assistant").length,
    summary: items.filter((x) => x.type === "summary").length,
    quiz: items.filter((x) => x.type === "quiz").length,
    note_activity: items.filter((x) => x.type === "note_activity").length,
  }), [items]);

  const togglePin = async (item) => {
    try {
      const response = await updateHistory(item._id, { pinned: !item.pinned });
      setItems((prev) => prev.map((x) => x._id === item._id ? response.data.item : x));
      setSelected(response.data.item);
      toast.success(item.pinned ? "Removed from pinned" : "Pinned to history");
    } catch (error) { toast.error(error.response?.data?.message || "Could not update pin"); }
  };

  const removeItem = async (item) => {
    if (!window.confirm(`Delete "${item.title || typeLabels[item.type]}" from history?`)) return;
    try {
      await deleteHistory(item._id);
      setItems((prev) => prev.filter((x) => x._id !== item._id));
      if (selected?._id === item._id) setSelected(null);
      toast.success("History item deleted");
    } catch (error) { toast.error(error.response?.data?.message || "Could not delete history item"); }
  };

  const formatDate = (date) => new Date(date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const metadata = selected?.metadata || {};

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar activeView="history" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar search={search} setSearch={setSearch} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-7">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><HistoryIcon size={24} /></div>
                  <div><h1 className="text-2xl font-bold text-slate-900">History</h1><p className="mt-1 text-sm text-slate-500">Your AI chats, summaries, quiz results, and note activity log.</p></div>
                </div>
              </div>
              <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><ArrowLeft size={17} /> Back to Dashboard</button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ["All History", "all", HistoryIcon],
                ["AI Assistant", "assistant", Bot],
                ["AI Summaries", "summary", FileText],
                ["Quiz Results", "quiz", Brain],
                ["Note Activity", "note_activity", Activity],
              ].map(([label, value, Icon]) => (
                <button key={value} onClick={() => chooseHistoryType(value)} className={`rounded-2xl border p-4 text-left transition ${type === value ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-100" : "border-slate-200 bg-white hover:border-indigo-200"}`}>
                  <Icon size={20} className={type === value ? "text-indigo-600" : "text-slate-400"} />
                  <p className="mt-3 text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{counts[value]}</p>
                </button>
              ))}
            </div>

            <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(200px,1fr)_160px_160px_auto] md:items-end">
                <label className="text-xs font-semibold text-slate-500">SEARCH HISTORY
                  <div className="relative mt-1.5"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles or content..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></div>
                </label>
                <label className="text-xs font-semibold text-slate-500">FROM DATE<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-700" /></label>
                <label className="text-xs font-semibold text-slate-500">TO DATE<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-700" /></label>
                <button onClick={() => setPinnedOnly((value) => !value)} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${pinnedOnly ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}><Pin size={16} /> {pinnedOnly ? "Pinned only" : "Show pinned"}</button>
              </div>
            </div>

            <div className="grid min-h-[420px] gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
              <section className="space-y-3">
                {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading history...</div> : visibleItems.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><HistoryIcon size={30} className="mx-auto text-slate-300" /><h3 className="mt-3 font-semibold text-slate-800">No history found</h3><p className="mt-1 text-sm text-slate-500">AI chats, summaries, quiz results, and note actions will appear here.</p></div> : visibleItems.map((item) => {
                  const Icon = typeIcons[item.type] || HistoryIcon;
                  const quizMeta = item.metadata || {};
                  return <div key={item._id} className={`relative rounded-2xl border transition ${selected?._id === item._id ? "border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-100" : "border-slate-200 bg-white hover:border-indigo-200"}`}>
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className="w-full rounded-2xl p-4 pr-12 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-300"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon size={19} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2"><h3 className="line-clamp-2 font-semibold text-slate-900">{item.title || typeLabels[item.type]}</h3>{item.pinned && <Pin size={15} className="shrink-0 text-amber-600" />}</div>
                          <p className="mt-1 text-xs text-indigo-600">{typeLabels[item.type]}</p>
                          <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-slate-500">{item.type === "assistant" ? item.messages?.filter((m) => m.role === "user").at(-1)?.content || "Conversation" : item.type === "quiz" ? `${quizMeta.correct ?? 0}/${quizMeta.totalQuestions ?? 0} correct • ${quizMeta.percentage ?? 0}%` : item.content || (item.type === "note_activity" ? "Note activity" : "Summary")}</p>
                          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400"><Clock3 size={13} />{formatDate(item.updatedAt || item.createdAt)}</p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      title="Delete history item"
                      aria-label={`Delete ${item.title || typeLabels[item.type]}`}
                      onClick={() => removeItem(item)}
                      className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-200"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>;
                })}
              </section>

              <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {!selected ? <div className="flex h-full min-h-[400px] flex-col items-center justify-center p-8 text-center text-slate-400"><HistoryIcon size={34} /><p className="mt-3 text-sm">Select a history item to view its details.</p></div> : <div className="flex h-full min-h-[400px] flex-col">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{typeLabels[selected.type]}</p><h2 className="mt-1 break-words text-lg font-bold text-slate-900">{selected.title}</h2><p className="mt-1 text-xs text-slate-400">{formatDate(selected.createdAt)}</p></div>
                    <div className="flex shrink-0 gap-1">
                      <button title={selected.pinned ? "Unpin" : "Pin"} onClick={() => togglePin(selected)} className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-600">{selected.pinned ? <PinOff size={18} /> : <Pin size={18} />}</button>
                      <button title="Delete" onClick={() => removeItem(selected)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={18} /></button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                    {selected.type === "assistant" && (selected.messages || []).map((message, index) => <div key={index} className={`rounded-2xl p-3.5 text-sm leading-6 whitespace-pre-wrap ${message.role === "user" ? "ml-8 bg-indigo-50 text-slate-800" : "mr-8 bg-slate-50 text-slate-700"}`}><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{message.role === "user" ? "You" : "AI Assistant"}</p>{message.content}{message.imageData && <img src={message.imageData} alt="Chat attachment" className="mt-3 max-h-56 rounded-xl border border-slate-200 object-contain" />}</div>)}
                    {selected.type === "summary" && <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selected.content}</div>}
                    {selected.type === "note_activity" && <div className="space-y-3">
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Activity</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{metadata.action || selected.title}</p>
                        {metadata.noteTitle && <p className="mt-1 text-sm text-slate-600">Note: {metadata.noteTitle}</p>}
                        <p className="mt-3 text-xs text-slate-500">{formatDate(selected.createdAt)}</p>
                      </div>
                      {selected.content && <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selected.content}</p>}
                    </div>}
                    {selected.type === "quiz" && <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[["Obtained Marks", metadata.obtainedMarks ?? metadata.correct ?? 0], ["Total Marks", metadata.totalMarks ?? metadata.totalQuestions ?? 0], ["Correct", metadata.correct ?? 0], ["Wrong", metadata.wrong ?? 0], ["Percentage", `${metadata.percentage ?? 0}%`]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>)}
                      </div>
                      {(metadata.questions || []).map((question, index) => {
                        const chosen = metadata.answers?.[index];
                        const correct = chosen === question.correctIndex;
                        return <div key={question.id || index} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-900">{index + 1}. {question.question}</p><div className="mt-3 space-y-2">{question.options?.map((option, optionIndex) => <div key={optionIndex} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${optionIndex === question.correctIndex ? "bg-emerald-50 text-emerald-800" : chosen === optionIndex ? "bg-red-50 text-red-800" : "text-slate-600"}`}>{optionIndex === question.correctIndex ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : chosen === optionIndex ? <XCircle size={16} className="mt-0.5 shrink-0" /> : <span className="w-4 shrink-0" />}{option}{chosen === optionIndex && <span className="ml-auto text-xs">{correct ? "Your answer" : "Your answer"}</span>}</div>)}</div><p className={`mt-2 text-xs font-medium ${correct ? "text-emerald-700" : "text-red-600"}`}>{chosen === undefined ? "Not answered" : correct ? "Correct answer selected" : "Incorrect answer"} • Correct: {question.options?.[question.correctIndex]}</p></div>;
                      })}
                    </>}
                  </div>
                </div>}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default History;
