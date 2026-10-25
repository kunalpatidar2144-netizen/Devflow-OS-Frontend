import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard,
  NotebookPen,
  Star,
  Archive,
  Bot,
  FileText,
  Brain,
  Calendar,
  Settings,
  LogOut,
  History as HistoryIcon,
  ClipboardCheck,
  ListTodo,
} from "lucide-react";

function Sidebar({
  activeView,
  setActiveView,
  onOpenAI,
  onOpenSummary,
  onOpenQuiz,
  onOpenCalendar,
  onNavigateView,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const onSettingsPage = location.pathname === "/settings";

  const closeActiveOverlay = () => {
    onNavigateView?.();
    localStorage.removeItem("devflow-active-ai-tool");
  };

  const chooseView = (view) => {
    closeActiveOverlay();
    if (onSettingsPage || !setActiveView) {
      navigate("/dashboard", { state: { view } });
      return;
    }
    setActiveView(view);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("devflow-ai-brain-active-chat-v1");
    // A new login must start a fresh AI chat, while saved conversations remain in History.
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key && key.startsWith("devflow-ai-assistant-draft-v1:")) {
        sessionStorage.removeItem(key);
      }
    }
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
  };

  const itemClass = (active = false) =>
    `flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
      active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-slate-800 bg-slate-900 p-4 text-white md:w-72 md:p-5">
      <div className="shrink-0 px-1">
        <h1 className="text-2xl font-bold">🚀 DevFlow OS</h1>
        <p className="mt-2 text-sm text-slate-400">Your AI Productivity Workspace</p>
      </div>

      <div className="mt-8 shrink-0 space-y-2">
        <button onClick={() => chooseView("all")} className={itemClass(!onSettingsPage && activeView === "all")}>
          <LayoutDashboard size={20} /> Dashboard
        </button>
        <button onClick={() => chooseView("notes")} className={itemClass(!onSettingsPage && activeView === "notes")}>
          <NotebookPen size={20} /> My Notes
        </button>
        <button onClick={() => chooseView("favorites")} className={itemClass(!onSettingsPage && activeView === "favorites")}>
          <Star size={20} /> Favorites
        </button>
        <button onClick={() => chooseView("archive")} className={itemClass(!onSettingsPage && activeView === "archive")}>
          <Archive size={20} /> Archive
        </button>
        <button onClick={() => { closeActiveOverlay(); navigate("/history"); }} className={itemClass(location.pathname === "/history" && !location.search || activeView === "history")}>
          <HistoryIcon size={20} /> History
        </button>
        <button onClick={() => { closeActiveOverlay(); navigate("/history?type=quiz"); }} className={itemClass(location.pathname === "/history" && location.search.includes("type=quiz"))}>
          <ClipboardCheck size={20} /> Quiz Results
        </button>
        <button onClick={() => { closeActiveOverlay(); navigate("/tasks"); }} className={itemClass(location.pathname === "/tasks" || activeView === "tasks")}>
          <ListTodo size={20} /> Tasks & Focus
        </button>
      </div>

      <div className="mt-8 shrink-0">
        <p className="mb-3 px-4 text-xs uppercase tracking-wider text-slate-500">AI Features</p>
        <div className="space-y-2">
          <button onClick={() => onOpenAI ? onOpenAI() : navigate("/dashboard")} className={itemClass()}>
            <Bot size={20} /> AI Assistant
          </button>
          <button onClick={() => { closeActiveOverlay(); navigate("/brain"); }} className={itemClass(location.pathname === "/brain")}>
            <Brain size={20} /> AI Brain (RAG)
          </button>
          <button onClick={() => onOpenSummary ? onOpenSummary() : navigate("/dashboard")} className={itemClass()}>
            <FileText size={20} /> AI Summary
          </button>
          <button onClick={() => onOpenQuiz ? onOpenQuiz() : navigate("/dashboard")} className={itemClass()}>
            <Brain size={20} /> AI Quiz
          </button>
        </div>
      </div>

      <div className="mt-auto shrink-0 space-y-2 border-t border-slate-800 pt-5">
        <button onClick={() => onOpenCalendar ? onOpenCalendar() : navigate("/dashboard")} className={itemClass()}>
          <Calendar size={20} /> Calendar
        </button>
        <button onClick={() => { closeActiveOverlay(); navigate("/settings"); }} className={itemClass(onSettingsPage)}>
          <Settings size={20} /> Settings
        </button>
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-red-400 transition hover:bg-red-500 hover:text-white">
          <LogOut size={20} /> Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
