import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Circle, Clock3, ListTodo, LoaderCircle, Pause, Play, Plus, RefreshCw, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { createTask, deleteTask, generateTaskPlan, getTasks, updateTask } from "../services/taskService";

const emptyForm = { title: "", description: "", priority: "medium", dueDate: "", status: "todo" };
const priorityStyles = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-rose-100 text-rose-700",
};

function localDateAfter(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [goal, setGoal] = useState("");
  const [availableTime, setAvailableTime] = useState("1-2 hours per day");
  const [planning, setPlanning] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState("focus");
  const [sessions, setSessions] = useState(() => Number(localStorage.getItem("devflow-focus-sessions") || 0));

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getTasks({ search: search.trim() || undefined, status: statusFilter });
      setTasks(response.data.tasks || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load tasks");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = window.setInterval(() => {
      setSecondsLeft((remaining) => {
        if (remaining <= 1) {
          window.clearInterval(interval);
          setTimerRunning(false);
          if (timerMode === "focus") {
            const next = sessions + 1;
            setSessions(next);
            localStorage.setItem("devflow-focus-sessions", String(next));
            toast.success("Focus session complete. Take a short break!");
          } else {
            toast.success("Break complete. Ready for another focus session?");
          }
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, timerMode, sessions]);

  const counts = useMemo(() => ({
    all: tasks.length,
    todo: tasks.filter((task) => task.status === "todo").length,
    inProgress: tasks.filter((task) => task.status === "in-progress").length,
    done: tasks.filter((task) => task.status === "done").length,
  }), [tasks]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (task) => {
    setEditingId(task._id);
    setForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : "",
      status: task.status || "todo",
    });
    setShowForm(true);
  };

  const saveTask = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return toast.error("Task title is required");
    setSaving(true);
    try {
      const payload = { ...form, dueDate: form.dueDate || null };
      if (editingId) await updateTask(editingId, payload);
      else await createTask(payload);
      toast.success(editingId ? "Task updated" : "Task created");
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      await loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save task");
    } finally { setSaving(false); }
  };

  const toggleComplete = async (task) => {
    const status = task.status === "done" ? "todo" : "done";
    try {
      const response = await updateTask(task._id, { status });
      setTasks((current) => current.map((item) => item._id === task._id ? response.data.task : item));
    } catch (error) { toast.error(error.response?.data?.message || "Could not update task"); }
  };

  const removeTask = async (task) => {
    try {
      await deleteTask(task._id);
      setTasks((current) => current.filter((item) => item._id !== task._id));
      setTaskPendingDelete(null);
      toast.success("Task deleted");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete task");
      return false;
    }
  };

  const planTasks = async (event) => {
    event.preventDefault();
    if (!goal.trim()) return toast.error("Enter a goal first");
    setPlanning(true);
    setSuggestions([]);
    try {
      const response = await generateTaskPlan({ goal: goal.trim(), availableTime, existingTasks: tasks.map((task) => ({ title: task.title })) });
      setSuggestions((response.data.tasks || []).map((task, index) => ({ ...task, id: `${Date.now()}-${index}`, selected: true })));
      if (!(response.data.tasks || []).length) toast.error("The AI did not return any tasks");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not generate an AI plan");
    } finally { setPlanning(false); }
  };

  const saveSuggestions = async () => {
    const selected = suggestions.filter((task) => task.selected);
    if (!selected.length) return toast.error("Select at least one suggested task");
    setSavingPlan(true);
    try {
      await Promise.all(selected.map((task) => createTask({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: "todo",
        dueDate: localDateAfter(task.daysFromNow),
      })));
      toast.success(`${selected.length} AI-planned task${selected.length === 1 ? "" : "s"} added`);
      setSuggestions([]);
      setGoal("");
      await loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.message || "Some tasks could not be saved. Refresh the list and check before retrying.");
      await loadTasks();
    } finally { setSavingPlan(false); }
  };

  const chooseTimerMode = (mode) => {
    setTimerRunning(false);
    setTimerMode(mode);
    const duration = mode === "focus" ? focusMinutes : mode === "short" ? 5 : 15;
    setSecondsLeft(duration * 60);
  };

  const changeFocusDuration = (value) => {
    const duration = Number(value);
    setFocusMinutes(duration);
    if (timerMode === "focus") {
      setTimerRunning(false);
      setSecondsLeft(duration * 60);
    }
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setSecondsLeft((timerMode === "focus" ? focusMinutes : timerMode === "short" ? 5 : 15) * 60);
  };

  const timerLabel = timerMode === "focus" ? "Focus session" : timerMode === "short" ? "Short break" : "Long break";
  const formattedTime = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const progress = 1 - secondsLeft / ((timerMode === "focus" ? focusMinutes : timerMode === "short" ? 5 : 15) * 60);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar activeView="tasks" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar search={search} setSearch={setSearch} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-7">
          <div className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><ListTodo size={24} /></div><div><h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Tasks & Focus</h1><p className="mt-1 text-sm text-slate-500">Plan your work, use AI to break down goals, and focus one session at a time.</p></div></div>
              </div>
              <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"><Plus size={17} /> New task</button>
            </header>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[["Total tasks", counts.all, ListTodo, "bg-indigo-100 text-indigo-700"], ["To do", counts.todo, Circle, "bg-slate-100 text-slate-600"], ["In progress", counts.inProgress, Clock3, "bg-amber-100 text-amber-700"], ["Completed", counts.done, CheckCircle2, "bg-emerald-100 text-emerald-700"]].map(([label, value, Icon, style]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">{label}</span><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${style}`}><Icon size={18} /></span></div><p className="mt-3 text-2xl font-bold text-slate-900">{value}</p></div>)}
            </section>

            <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">My tasks</h2><p className="mt-1 text-sm text-slate-500">Tasks are private to your account.</p></div><button onClick={loadTasks} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Refresh tasks"><RefreshCw size={17} /></button></div>
                <div className="mt-4 flex flex-wrap gap-2">{[["all", "All"], ["todo", "To do"], ["in-progress", "In progress"], ["done", "Completed"]].map(([value, label]) => <button key={value} onClick={() => setStatusFilter(value)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${statusFilter === value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>)}</div>
                <div className="mt-4 space-y-3">
                  {loading ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} /> Loading tasks…</div> : tasks.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center"><ListTodo className="mx-auto text-slate-300" size={30} /><p className="mt-3 font-semibold text-slate-700">No tasks found</p><p className="mt-1 text-sm text-slate-500">Create a task or ask AI to break down a goal.</p></div> : tasks.map((task) => <article key={task._id} className={`rounded-xl border p-4 transition ${task.status === "done" ? "border-emerald-100 bg-emerald-50/50" : "border-slate-200 hover:border-indigo-200"}`}>
                    <div className="flex items-start gap-3"><button onClick={() => toggleComplete(task)} className={`mt-0.5 shrink-0 ${task.status === "done" ? "text-emerald-600" : "text-slate-300 hover:text-indigo-600"}`} aria-label={task.status === "done" ? "Mark task incomplete" : "Mark task complete"}>{task.status === "done" ? <CheckCircle2 size={21} /> : <Circle size={21} />}</button><div className="min-w-0 flex-1"><button onClick={() => openEdit(task)} className={`text-left font-semibold ${task.status === "done" ? "text-slate-400 line-through" : "text-slate-900 hover:text-indigo-700"}`}>{task.title}</button>{task.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{task.description}</p>}<div className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${priorityStyles[task.priority] || priorityStyles.medium}`}>{task.priority} priority</span><select aria-label="Task status" value={task.status} onChange={(e) => updateTask(task._id, { status: e.target.value }).then(() => loadTasks()).catch((error) => toast.error(error.response?.data?.message || "Could not update task"))} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"><option value="todo">To do</option><option value="in-progress">In progress</option><option value="done">Completed</option></select>{task.dueDate && <span className={`text-xs ${task.status !== "done" && new Date(task.dueDate) < new Date(new Date().toDateString()) ? "font-semibold text-rose-600" : "text-slate-500"}`}>Due {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>}</div></div><button onClick={() => setTaskPendingDelete(task)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete task ${task.title}`}><Trash2 size={16} /></button></div>
                  </article>)}
                </div>
              </div>

              <div className="space-y-5">
                <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white">
                  <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-indigo-300"><Clock3 size={18} /><span className="text-xs font-semibold uppercase tracking-wider">Focus timer</span></div><h2 className="mt-2 text-xl font-bold">{timerLabel}</h2><p className="mt-1 text-sm text-slate-400">Small, focused sessions add up.</p></div><div className="rounded-xl bg-white/10 px-3 py-2 text-center"><p className="text-xl font-bold">{sessions}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">Sessions</p></div></div>
                  <div className="my-5 flex justify-center"><div className="relative flex h-48 w-48 items-center justify-center rounded-full" style={{ background: `conic-gradient(#818cf8 ${progress * 360}deg, #334155 0deg)` }}><div className="flex h-40 w-40 flex-col items-center justify-center rounded-full bg-slate-900"><span className="font-mono text-4xl font-semibold tracking-tight">{formattedTime}</span><span className="mt-1 text-xs text-slate-400">{timerRunning ? "Stay focused" : "Ready when you are"}</span></div></div></div>
                  <div className="flex justify-center gap-2"><button onClick={() => setTimerRunning((running) => !running)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold hover:bg-indigo-400">{timerRunning ? <Pause size={17} /> : <Play size={17} />}{timerRunning ? "Pause" : "Start"}</button><button onClick={resetTimer} className="rounded-xl border border-slate-700 px-3 py-2.5 text-slate-300 hover:bg-slate-800" aria-label="Reset timer"><RefreshCw size={17} /></button></div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">{[["focus", "Focus"], ["short", "5 min break"], ["long", "15 min break"]].map(([mode, label]) => <button key={mode} onClick={() => chooseTimerMode(mode)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${timerMode === mode ? "bg-white text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{label}</button>)}</div>
                  {timerMode === "focus" && <label className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">Focus length <select value={focusMinutes} disabled={timerRunning} onChange={(e) => changeFocusDuration(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-white"><option value={15}>15 minutes</option><option value={25}>25 minutes</option><option value={45}>45 minutes</option><option value={50}>50 minutes</option></select></label>}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><WandSparkles size={19} /></span><div><h2 className="font-bold text-slate-900">AI task planner</h2><p className="text-xs text-slate-500">Turn a goal into actionable steps.</p></div></div>
                  <form onSubmit={planTasks} className="mt-4 space-y-3"><label className="block text-xs font-semibold text-slate-600">YOUR GOAL<textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} maxLength={2000} placeholder="e.g. Prepare for my MERN stack interview in two weeks" className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm font-normal text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label><label className="block text-xs font-semibold text-slate-600">AVAILABLE TIME<select value={availableTime} onChange={(e) => setAvailableTime(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal text-slate-700"><option>30 minutes per day</option><option>1-2 hours per day</option><option>3-4 hours per day</option><option>Flexible schedule</option></select></label><button disabled={planning} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">{planning ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />}{planning ? "Planning…" : "Generate task plan"}</button></form>
                  {suggestions.length > 0 && <div className="mt-4 space-y-3 border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-800">Review suggestions</h3><button onClick={() => setSuggestions([])} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Clear suggestions"><X size={16} /></button></div>{suggestions.map((task) => <div key={task.id} className="flex gap-2 rounded-xl border border-slate-100 p-3"><input aria-label={`Include ${task.title}`} type="checkbox" checked={task.selected} onChange={(e) => setSuggestions((current) => current.map((item) => item.id === task.id ? { ...item, selected: e.target.checked } : item))} className="mt-1 accent-violet-600" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{task.title}</span>{task.description && <span className="mt-1 block text-xs text-slate-500">{task.description}</span>}<span className="mt-1 block text-xs capitalize text-violet-700">{task.priority} priority · due {task.daysFromNow === 0 ? "today" : `in ${task.daysFromNow} day${task.daysFromNow === 1 ? "" : "s"}`}</span></span><button type="button" onClick={() => setSuggestions((current) => current.filter((item) => item.id !== task.id))} className="self-start rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete suggested task ${task.title}`} title="Remove task"><Trash2 size={15} /></button></div>)}<button disabled={savingPlan} onClick={saveSuggestions} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{savingPlan ? <LoaderCircle className="animate-spin" size={17} /> : <Check size={17} />}{savingPlan ? "Saving…" : "Add selected tasks"}</button></div>}
                </section>
              </div>
            </section>
          </div>
        </main>
      </div>

      {showForm && <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setShowForm(false)}><form onSubmit={saveTask} onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">{editingId ? "Edit task" : "Create task"}</h2><p className="mt-1 text-sm text-slate-500">Keep the next action clear and achievable.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close task form"><X size={18} /></button></div><div className="mt-5 space-y-4"><label className="block text-sm font-medium text-slate-700">Title<input required maxLength={180} value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="What needs to get done?" /></label><label className="block text-sm font-medium text-slate-700">Description<textarea rows={3} maxLength={4000} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="Optional details" /></label><div className="grid gap-4 sm:grid-cols-3"><label className="block text-sm font-medium text-slate-700">Priority<select value={form.priority} onChange={(e) => setForm((current) => ({ ...current, priority: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label className="block text-sm font-medium text-slate-700">Status<select value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"><option value="todo">To do</option><option value="in-progress">In progress</option><option value="done">Completed</option></select></label><label className="block text-sm font-medium text-slate-700">Due date<input type="date" value={form.dueDate} onChange={(e) => setForm((current) => ({ ...current, dueDate: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" /></label></div></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><div>{editingId && <button type="button" onClick={() => setTaskPendingDelete(tasks.find((item) => item._id === editingId) || null)} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"><Trash2 size={16} /> Delete task</button>}</div><div className="flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Saving…" : editingId ? "Save changes" : "Create task"}</button></div></div></form></div>}
      {taskPendingDelete && <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTaskPendingDelete(null); }}><div role="dialog" aria-modal="true" aria-labelledby="delete-task-title" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><Trash2 size={20} /></div><div className="min-w-0"><h2 id="delete-task-title" className="font-bold text-slate-900">Delete this task?</h2><p className="mt-1 break-words text-sm leading-5 text-slate-500">“{taskPendingDelete.title}” will be permanently removed.</p></div></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setTaskPendingDelete(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={async () => { const deleted = await removeTask(taskPendingDelete); if (deleted) setShowForm(false); }} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Delete task</button></div></div></div>}
    </div>
  );
}

export default Tasks;
