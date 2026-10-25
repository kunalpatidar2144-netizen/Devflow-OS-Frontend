import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Plus,
  X,
  Star,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Bot,
  UserRound,
  Mail,
  ShieldCheck,
  Fingerprint,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Video,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import StatCard from "../components/StatCard";
import NoteCard from "../components/NoteCard";
import AIAssistant from "../components/AIAssistant";
import AISummary from "../components/AISummary";
import AIQuiz from "../components/AIQuiz";
import CalendarView from "../components/CalendarView";

import {
  createNote,
  getAllNotes,
  deleteNote,
  updateNote,
  toggleFavorite,
  archiveNote,
  unarchiveNote,
  getArchivedNotes,
  searchNotes,
} from "../services/noteService";

import { getEventReminders } from "../services/eventService";
import { getUserProfile } from "../services/userService";

function parseEventDateTime(event) {
  if (!event?.date || !event?.time) return null;

  const dateKey = String(event.date).slice(0, 10);
  const match = String(event.time).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (period && hours <= 12) {
    hours = hours % 12;
    if (period === "PM") hours += 12;
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day || hours > 23 || minutes > 59) return null;

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function Dashboard() {
  const location = useLocation();
  const [activeView, setActiveView] = useState(() => {
    // Restore the exact Dashboard section the user was viewing before refresh.
    const routeView = location.state?.view;
    if (routeView) return routeView;
    try {
      const savedView = localStorage.getItem("devflow-last-dashboard-view");
      if (["all", "notes", "favorites", "archive"].includes(savedView)) return savedView;
      const saved = JSON.parse(localStorage.getItem("devflowSettings") || "{}");
      if (saved.notes?.defaultView === "notes") return "notes";
      if (saved.notes?.defaultView === "favorites") return "favorites";
    } catch {}
    return "all";
  });

  useEffect(() => {
    if (location.state?.view) {
      setActiveView(location.state.view);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (["all", "notes", "favorites", "archive"].includes(activeView)) {
      localStorage.setItem("devflow-last-dashboard-view", activeView);
    }
  }, [activeView]);

  // =========================
  // Search
  // =========================
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  // =========================
  // Create Note
  // =========================
  const [showCreateNote, setShowCreateNote] =
    useState(false);

  const [noteData, setNoteData] = useState({
    title: "",
    content: "",
  });

  const [creatingNote, setCreatingNote] =
    useState(false);
  const [noteFiles, setNoteFiles] = useState([]);
  const [editNoteFiles, setEditNoteFiles] = useState([]);

  // =========================
  // Notes
  // =========================
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] =
    useState(true);

  // =========================
  // Archived Notes
  // =========================
  const [archivedNotes, setArchivedNotes] =
    useState([]);

  const [loadingArchived, setLoadingArchived] =
    useState(false);

  // =========================
  // Edit
  // =========================
  const [editingNote, setEditingNote] =
    useState(false);

  const [editNoteData, setEditNoteData] =
    useState({
      id: "",
      title: "",
      content: "",
    });

  // =========================
  // Action Loading
  // =========================
  const [actionLoadingId, setActionLoadingId] =
    useState(null);

  // =========================
  // Selected Note
  // =========================
  const [selectedNote, setSelectedNote] =
    useState(null);

  // =========================
  // Full Screen
  // =========================
  const [fullScreenNote, setFullScreenNote] =
    useState(false);

  // =========================
  // AI Assistant
  // =========================
  // Do not reopen a previous AI panel automatically after a fresh app/login mount.
  // Opening the Assistant starts a new chat; saved chats remain in its History.
  const [showAIAssistant, setShowAIAssistant] = useState(() => localStorage.getItem("devflow-active-ai-tool") === "assistant");

  // =========================
  // AI Summary
  // =========================
  const [showAISummary, setShowAISummary] =
    useState(() => localStorage.getItem("devflow-active-ai-tool") === "summary");

  const [showAIQuiz, setShowAIQuiz] =
    useState(() => localStorage.getItem("devflow-active-ai-tool") === "quiz");

  // Restore the last AI workspace after a page refresh and remember tool switches.
  useEffect(() => {
    const activeTool = showAIAssistant
      ? "assistant"
      : showAISummary
      ? "summary"
      : showAIQuiz
      ? "quiz"
      : "";

    if (activeTool) localStorage.setItem("devflow-active-ai-tool", activeTool);
    else localStorage.removeItem("devflow-active-ai-tool");
  }, [showAIAssistant, showAISummary, showAIQuiz]);

  const [showCalendar, setShowCalendar] =
    useState(false);

  // Event reminders and profile
  const [eventNotifications, setEventNotifications] = useState([]);
  const alertedReminderIds = useRef(new Set());
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("user") ||
        sessionStorage.getItem("user") ||
        "null"
      );
    } catch {
      return null;
    }
  });
  const [showProfile, setShowProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // =========================
  // Format Note
  // =========================
  const formatNote = useCallback(
    (note) => ({
      id: note._id,
      title: note.title,
      description: note.content,
      attachments: Array.isArray(note.attachments) ? note.attachments : [],
      isFavorite: note.isFavorite,
      isArchived: note.isArchived,
      category: "General",
      date: new Date(
        note.createdAt
      ).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    }),
    []
  );

  // =========================
  // Get Normal Notes
  // =========================
  const fetchNotes = useCallback(async () => {
    try {
      setLoadingNotes(true);

      const response = await getAllNotes();

      const formattedNotes =
        response.data.notes.map(formatNote);

      setNotes(formattedNotes);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to load notes"
      );
    } finally {
      setLoadingNotes(false);
    }
  }, [formatNote]);

  // =========================
  // Get Archived Notes
  // =========================
  const fetchArchivedNotes = useCallback(async () => {
    try {
      setLoadingArchived(true);

      const response =
        await getArchivedNotes();

      const formattedNotes =
        response.data.notes.map(formatNote);

      setArchivedNotes(formattedNotes);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to load archived notes"
      );
    } finally {
      setLoadingArchived(false);
    }
  }, [formatNote]);

  // =========================
  // Event Notifications and exact-time alerts while the app is open
  // =========================
  const checkDueEventReminders = useCallback((reminders) => {
    let preferences = {};
    try { preferences = JSON.parse(localStorage.getItem("devflowSettings") || "{}"); } catch {}
    if (preferences.notifications?.eventReminders === false) return;

    const now = new Date();
    const leadMinutes = Math.max(0, Number(preferences.notifications?.reminderMinutesBefore || 0));

    reminders.forEach((event) => {
      const eventId = event._id || event.id;
      if (!eventId || alertedReminderIds.current.has(eventId)) return;

      const eventDateTime = parseEventDateTime(event);
      if (!eventDateTime) return;

      const reminderDateTime = new Date(eventDateTime.getTime() - leadMinutes * 60_000);
      const elapsed = now.getTime() - reminderDateTime.getTime();
      // Polling every 15 seconds; this window tolerates brief request delays.
      if (elapsed >= 0 && elapsed <= 45_000) {
        alertedReminderIds.current.add(eventId);
        const message = `Reminder: ${event.title}`;
        const detail = `${event.time} • ${eventDateTime.toLocaleDateString("en-IN")}`;
        toast.warning(message, { description: detail, duration: 12000 });
        if (preferences.notifications?.browserNotifications && "Notification" in window && Notification.permission === "granted") {
          new Notification(message, { body: detail });
        }
      }
    });
  }, []);

  const fetchEventReminders = useCallback(async () => {
    try {
      const response = await getEventReminders();
      const reminders = response.data.reminders || [];
      setEventNotifications(reminders);
      checkDueEventReminders(reminders);
    } catch (error) {
      console.error(
        "Reminder Error:",
        error.response?.data?.message || error.message
      );
    }
  }, [checkDueEventReminders]);

  const handleOpenProfile = async () => {
    setShowProfile(true);
    setLoadingProfile(true);

    try {
      const response = await getUserProfile();
      const currentUser = response.data.user;
      setProfile(currentUser);

      const storage = localStorage.getItem("token")
        ? localStorage
        : sessionStorage;
      storage.setItem("user", JSON.stringify(currentUser));
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not load your profile"
      );
    } finally {
      setLoadingProfile(false);
    }
  };

  // Initial load + repeat reminder check while the dashboard is open.
  useEffect(() => {
    fetchNotes();
    fetchArchivedNotes();
    fetchEventReminders();

    const reminderInterval = window.setInterval(fetchEventReminders, 15000);
    return () => window.clearInterval(reminderInterval);
  }, [fetchNotes, fetchArchivedNotes, fetchEventReminders]);

  // =========================
  // Archive View
  // =========================
  useEffect(() => {
    if (activeView === "archive") {
      fetchArchivedNotes();
    }
  }, [activeView, fetchArchivedNotes]);

  // =========================
  // Search
  // =========================
  const handleSearch = async (value) => {
    setSearch(value);

    if (!value.trim()) {
      if (activeView === "archive") {
        fetchArchivedNotes();
      } else {
        fetchNotes();
      }

      return;
    }

    if (activeView === "archive") {
      const filtered =
        archivedNotes.filter((note) =>
          note.title
            .toLowerCase()
            .includes(value.toLowerCase())
        );

      setArchivedNotes(filtered);

      return;
    }

    try {
      setSearching(true);

      const response =
        await searchNotes(value);

      const formattedNotes =
        response.data.notes.map(formatNote);

      setNotes(formattedNotes);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to search notes"
      );
    } finally {
      setSearching(false);
    }
  };

  // =========================
  // Create Note Input
  // =========================
  const handleNoteChange = (e) => {
    setNoteData({
      ...noteData,
      [e.target.name]: e.target.value,
    });
  };

  // =========================
  // Create Note
  // =========================
  const handleFileSelection = (event, setter, existingCount = 0) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    const allowed = picked.filter((file) => {
      const isAllowed = file.type === "application/pdf" || file.type.startsWith("image/") || file.type.startsWith("video/");
      if (!isAllowed) toast.warning(`${file.name}: only PDF, image, or video files are allowed.`);
      if (file.size > 50 * 1024 * 1024) {
        toast.warning(`${file.name}: file must be 50 MB or smaller.`);
        return false;
      }
      return isAllowed;
    });
    setter((current) => {
      const remaining = Math.max(0, 10 - existingCount - current.length);
      const selected = allowed.slice(0, remaining);
      if (allowed.length > remaining) toast.warning("You can attach up to 10 files per note.");
      return [...current, ...selected];
    });
  };

  const removeSelectedFile = (setter, index) => {
    setter((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  const renderAttachments = (attachments = []) => {
    if (!attachments.length) return null;
    return (
      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attachments</p>
        {attachments.map((attachment, index) => {
          const isVideo = attachment.resourceType === "video" || attachment.mimeType?.startsWith("video/");
          const isImage = attachment.resourceType === "image" || attachment.mimeType?.startsWith("image/");
          const Icon = isVideo ? Video : isImage ? ImageIcon : FileText;
          return (
            <a key={attachment.publicId || attachment.url || `${attachment.name}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Icon size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{attachment.name || "Attached file"}</span><span className="text-xs text-slate-400">{attachment.format?.toUpperCase() || (isVideo ? "VIDEO" : isImage ? "IMAGE" : "FILE")}</span></span>
              <ExternalLink size={15} className="shrink-0 text-slate-400" />
            </a>
          );
        })}
      </div>
    );
  };

  const renderSelectedFiles = (files, setter) => files.length > 0 && (
    <div className="mt-3 flex flex-wrap gap-2">
      {files.map((file, index) => (
        <span key={`${file.name}-${file.size}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
          <Paperclip size={14} className="shrink-0" />
          <span className="max-w-[220px] truncate">{file.name}</span>
          <button type="button" onClick={() => removeSelectedFile(setter, index)} aria-label={`Remove ${file.name}`} className="rounded-full p-0.5 hover:bg-indigo-100"><X size={14} /></button>
        </span>
      ))}
    </div>
  );

  const handleCreateNote = async () => {
    if (!noteData.title.trim() || (!noteData.content.trim() && noteFiles.length === 0)) {
      toast.warning("Add a title and either note text or an attachment.");
      return;
    }

    try {
      setCreatingNote(true);

      const response = await createNote(noteData, noteFiles);

      const newNote = formatNote(
        response.data.note
      );

      setNotes((prevNotes) => [
        newNote,
        ...prevNotes,
      ]);

      setNoteData({
        title: "",
        content: "",
      });
      setNoteFiles([]);

      setShowCreateNote(false);
      setSearch("");

      toast.success(
        "Note Created Successfully"
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to create note"
      );
    } finally {
      setCreatingNote(false);
    }
  };

  // =========================
  // Delete Note
  // =========================
  const handleDeleteNote = async (id) => {
    try {
      setActionLoadingId(id);

      await deleteNote(id);

      setNotes((prevNotes) =>
        prevNotes.filter(
          (note) => note.id !== id
        )
      );

      setArchivedNotes((prevNotes) =>
        prevNotes.filter(
          (note) => note.id !== id
        )
      );

      setSelectedNote(null);
      setFullScreenNote(false);
      setShowAIAssistant(false);
      setShowAISummary(false);

      toast.success(
        "Note Deleted Successfully"
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to delete note"
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // =========================
  // Edit Note
  // =========================
  const handleEditNote = (id) => {
    const note =
      notes.find(
        (note) => note.id === id
      ) ||
      archivedNotes.find(
        (note) => note.id === id
      );

    if (!note) return;

    setEditNoteData({
      id: note.id,
      title: note.title,
      content: note.description,
      attachments: note.attachments || [],
    });
    setEditNoteFiles([]);

    // Keep the current note and Full Mode open while editing.
    setEditingNote(true);
  };

  // =========================
  // Update Note
  // =========================
  const handleUpdateNote = async () => {
    if (!editNoteData.title.trim() || (!editNoteData.content.trim() && !(editNoteData.attachments || []).length && !editNoteFiles.length)) {
      toast.warning("Add a title and either note text or an attachment.");
      return;
    }

    try {
      setActionLoadingId(
        editNoteData.id
      );

      const response =
        await updateNote(
          editNoteData.id,
          {
            title: editNoteData.title,
            content: editNoteData.content,
          },
          editNoteFiles
        );

      const formattedNote =
        formatNote(
          response.data.note
        );

      setNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.id === editNoteData.id
            ? formattedNote
            : note
        )
      );

      setArchivedNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.id === editNoteData.id
            ? formattedNote
            : note
        )
      );

      setEditingNote(false);

      setEditNoteData({
        id: "",
        title: "",
        content: "",
        attachments: [],
      });
      setEditNoteFiles([]);

      toast.success(
        "Note Updated Successfully"
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to update note"
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // =========================
  // Favorite
  // =========================
  const handleFavoriteNote = async (id) => {
    try {
      const response =
        await toggleFavorite(id);

      const updatedNote =
        response.data.note;

      setNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.id === id
            ? {
                ...note,
                isFavorite:
                  updatedNote.isFavorite,
              }
            : note
        )
      );

      setArchivedNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.id === id
            ? {
                ...note,
                isFavorite:
                  updatedNote.isFavorite,
              }
            : note
        )
      );

      setSelectedNote((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              isFavorite:
                updatedNote.isFavorite,
            }
          : prev
      );

      toast.success(
        updatedNote.isFavorite
          ? "Added to Favorites ⭐"
          : "Removed from Favorites"
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to update favorite"
      );
    }
  };

  // =========================
  // Archive
  // =========================
  const handleArchiveNote = async (id) => {
    try {
      setActionLoadingId(id);

      const response =
        await archiveNote(id);

      const archivedNote =
        formatNote(response.data.note);

      setNotes((prevNotes) =>
        prevNotes.filter(
          (note) => note.id !== id
        )
      );

      setArchivedNotes((prevNotes) => [
        archivedNote,
        ...prevNotes,
      ]);

      setSelectedNote(null);
      setFullScreenNote(false);
      setShowAIAssistant(false);
      setShowAISummary(false);

      toast.success(
        "Note Archived Successfully 📦"
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to archive note"
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // =========================
  // Unarchive
  // =========================
  const handleUnarchiveNote = async (id) => {
    try {
      setActionLoadingId(id);

      const response =
        await unarchiveNote(id);

      const restoredNote =
        formatNote(response.data.note);

      setArchivedNotes((prevNotes) =>
        prevNotes.filter(
          (note) => note.id !== id
        )
      );

      setNotes((prevNotes) => [
        restoredNote,
        ...prevNotes,
      ]);

      setSelectedNote(null);
      setFullScreenNote(false);
      setShowAIAssistant(false);
      setShowAISummary(false);

      toast.success(
        "Note Restored Successfully 🔄"
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to restore note"
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // =========================
  // Open Note
  // =========================
  const handleOpenNote = (id) => {
    const note =
      notes.find(
        (note) => note.id === id
      ) ||
      archivedNotes.find(
        (note) => note.id === id
      );

    if (!note) return;

    setSelectedNote(note);
    setFullScreenNote(false);
    setShowAIAssistant(false);
    setShowAISummary(false);
  };

  // =========================
  // Open AI Assistant
  // =========================
  const handleOpenAIAssistant = () => {
    setShowAISummary(false);
    setShowAIQuiz(false);
    setShowAIAssistant(true);
  };

  // =========================
  // Open AI Summary
  // =========================
  const handleOpenAISummary = () => {
    setShowAIAssistant(false);
    setShowAIQuiz(false);
    setShowAISummary(true);
  };

  const handleOpenAIQuiz = () => {
    setShowAIAssistant(false);
    setShowAISummary(false);
    setShowAIQuiz(true);
  };

  const handleOpenCalendar = () => {
    // Switch to Calendar as the active workspace so it never opens behind an AI panel.
    setShowAIAssistant(false);
    setShowAISummary(false);
    setShowAIQuiz(false);
    setShowProfile(false);
    setShowCalendar(true);
  };

  // =========================
  // Counts
  // =========================
  const favoriteCount =
    notes.filter(
      (note) => note.isFavorite
    ).length +
    archivedNotes.filter(
      (note) => note.isFavorite
    ).length;

  const archivedCount =
    archivedNotes.length;

  // =========================
  // Display Notes
  // =========================
  let displayedNotes = activeView === "all" ? notes.slice(0, 3) : notes;

  if (activeView === "favorites") {
    displayedNotes = notes.filter(
      (note) => note.isFavorite
    );
  }

  if (activeView === "archive") {
    displayedNotes = archivedNotes;
  }

  try {
    const preferences = JSON.parse(localStorage.getItem("devflowSettings") || "{}");
    if (preferences.notes?.sortBy === "title") {
      displayedNotes = [...displayedNotes].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
  } catch {}

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">

      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenAI={handleOpenAIAssistant}
        onOpenSummary={handleOpenAISummary}
        onOpenQuiz={handleOpenAIQuiz}
        onOpenCalendar={handleOpenCalendar}
        onNavigateView={() => {
          setShowAIAssistant(false);
          setShowAISummary(false);
          setShowAIQuiz(false);
          localStorage.removeItem("devflow-active-ai-tool");
        }}
      />

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Navbar */}
        <Navbar
          search={search}
          setSearch={handleSearch}
          eventNotifications={eventNotifications}
          onOpenCalendar={handleOpenCalendar}
          user={profile}
          onOpenProfile={handleOpenProfile}
        />

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">

         

          {activeView === "all" && (
            <section className="mb-8 space-y-6">
              <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-blue-800 p-6 text-white shadow-sm sm:p-8">
                <p className="text-sm font-medium text-blue-100">Your workspace at a glance</p>
                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                  Welcome back, {profile?.fullName || profile?.name || "there"}!
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-200">
                  Review your notes, keep track of upcoming events, and use AI tools to stay productive.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView("notes")}
                  className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-blue-50"
                >
                  View all notes
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Total Notes" value={notes.length} color="text-blue-600" />
                <StatCard title="Favorites" value={favoriteCount} color="text-yellow-500" />
                <StatCard title="Archived" value={archivedCount} color="text-red-500" />
                <StatCard title="Upcoming Events" value={eventNotifications.length} color="text-green-600" />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">Upcoming events</h3>
                    <p className="text-sm text-slate-500">Events scheduled for today and the next two days</p>
                  </div>
                  <button type="button" onClick={handleOpenCalendar} className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-800">
                    Open calendar
                  </button>
                </div>
                {eventNotifications.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No upcoming events. Add one from Calendar.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {eventNotifications.slice(0, 4).map((event) => (
                      <div key={event._id || event.id} className="rounded-xl border border-slate-100 p-4">
                        <p className="font-medium text-slate-800">{event.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {event.date ? new Date(event.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "Date unavailable"}
                          {event.time ? ` • ${event.time}` : ""}
                        </p>
                        {event.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{event.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Notes: Dashboard shows a short recent preview; My Notes shows the full list. */}
          <div className={activeView === "all" ? "mt-8" : "mt-2"}>

            <div className="flex items-center justify-between mb-5">

              <h2 className="text-2xl font-bold text-slate-800">

                {activeView === "favorites"
                  ? "Favorite Notes ⭐"
                  : activeView === "archive"
                  ? "Archived Notes 📦"
                  : search.trim()
                  ? "Search Results 🔎"
                  : activeView === "notes"
                  ? "My Notes"
                  : "Recent Notes"}

              </h2>

              {searching && (
                <span className="text-sm text-slate-400">
                  Searching...
                </span>
              )}

              {activeView === "all" && notes.length > 3 && (
                <button
                  type="button"
                  onClick={() => setActiveView("notes")}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  View all notes
                </button>
              )}
              {(activeView === "favorites" || activeView === "archive") && (
                <button
                  type="button"
                  onClick={() => setActiveView("all")}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Back to Dashboard
                </button>
              )}

            </div>

            {/* Loading */}
            {loadingNotes ||
            (activeView === "archive" &&
              loadingArchived) ? (

              <p className="text-slate-500">
                Loading notes...
              </p>

            ) : displayedNotes.length === 0 ? (

              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">

                <p className="text-slate-500">

                  {search.trim()
                    ? "No matching notes found."
                    : activeView ===
                      "favorites"
                    ? "No favorite notes yet."
                    : activeView ===
                      "archive"
                    ? "No archived notes yet."
                    : activeView ===
                      "notes"
                    ? "No notes found."
                    : "No notes found."}

                </p>

                <p className="text-sm text-slate-400 mt-1">
                  {search.trim()
                    ? "Try searching with another title."
                    : "Click the + button to create a note."}
                </p>

              </div>

            ) : (

              <div className="space-y-5">

                {displayedNotes.map(
                  (note) => (
                    <NoteCard
                      key={note.id}
                      id={note.id}
                      title={note.title}
                      description={
                        note.description
                      }
                      category={
                        note.category
                      }
                      date={note.date}
                      attachments={note.attachments || []}
                      isFavorite={
                        note.isFavorite
                      }
                      onEdit={
                        handleEditNote
                      }
                      onDelete={
                        handleDeleteNote
                      }
                      onFavorite={
                        handleFavoriteNote
                      }
                      onOpen={
                        handleOpenNote
                      }
                      actionLoading={
                        actionLoadingId ===
                        note.id
                      }
                    />
                  )
                )}

              </div>
            )}

          </div>

        </main>

      </div>

      {/* ==================================================
          CREATE NOTE MODAL
      ================================================== */}
      {showCreateNote && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-[200] p-3 sm:p-5"
          onClick={() =>
            setShowCreateNote(false)
          }
        >

          <div
            className="bg-white w-full max-w-5xl h-[88vh] max-h-[900px] min-h-[520px] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-7 flex flex-col overflow-hidden"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="flex items-start justify-between gap-4 mb-5 sm:mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 mb-2">My Notes</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Create New Note
                </h2>
                <p className="text-sm text-slate-500 mt-1">Capture your ideas, study notes, and important details.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateNote(false)}
                aria-label="Close note editor"
                className="shrink-0 w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>

            <input
              type="text"
              name="title"
              value={noteData.title}
              onChange={
                handleNoteChange
              }
              placeholder="Note title"
              className="w-full shrink-0 border border-slate-200 bg-slate-50/70 rounded-xl px-4 py-3.5 mb-4 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
            />

            <textarea
              name="content"
              value={noteData.content}
              onChange={
                handleNoteChange
              }
              placeholder="Write your note..."
              rows="12"
              className="w-full flex-1 min-h-0 border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-4 sm:px-5 sm:py-5 mb-4 text-[15px] leading-7 text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition resize-none"
            />

            <div className="shrink-0 mb-3 max-h-[22vh] overflow-y-auto rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm"><Paperclip size={19} /></span><div><p className="font-semibold text-slate-800">Add files to your note</p><p className="mt-0.5 text-xs text-slate-500">PDF, screenshots, images or videos · up to 10 files · 50 MB each</p></div></div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"><Plus size={16} /> Attach files<input type="file" multiple accept="application/pdf,image/*,video/*" className="hidden" onChange={(event) => handleFileSelection(event, setNoteFiles)} /></label>
              </div>
              {renderSelectedFiles(noteFiles, setNoteFiles)}
            </div>

            <div className="mt-auto shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-slate-100 pt-4 pb-1">

              <button
                onClick={() => {
                  setShowCreateNote(false);

                  setNoteData({
                    title: "",
                    content: "",
                  });
                  setNoteFiles([]);
                }}
                className="px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition font-medium"
              >
                Cancel
              </button>

              <button
                onClick={handleCreateNote}
                disabled={creatingNote}
                className="px-6 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition disabled:opacity-60 font-semibold"
              >
                {creatingNote
                  ? "Creating..."
                  : "Create Note"}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* ==================================================
          EDIT NOTE MODAL
      ================================================== */}
      {editingNote && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-[300] p-3 sm:p-5"
          onClick={() =>
            setEditingNote(false)
          }
        >

          <div
            className="bg-white w-full max-w-5xl h-[88vh] max-h-[900px] min-h-[520px] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-7 flex flex-col overflow-hidden"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="flex items-start justify-between gap-4 mb-5 sm:mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 mb-2">My Notes</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Edit Note</h2>
                <p className="text-sm text-slate-500 mt-1">Make changes to your note and save when you're ready.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingNote(false)}
                aria-label="Close note editor"
                className="shrink-0 w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>

            <input
              type="text"
              value={editNoteData.title}
              onChange={(e) =>
                setEditNoteData({
                  ...editNoteData,
                  title: e.target.value,
                })
              }
              placeholder="Note title"
              className="w-full shrink-0 border border-slate-200 bg-slate-50/70 rounded-xl px-4 py-3.5 mb-4 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
            />

            <textarea
              value={editNoteData.content}
              onChange={(e) =>
                setEditNoteData({
                  ...editNoteData,
                  content: e.target.value,
                })
              }
              placeholder="Write your note..."
              rows="12"
              className="w-full flex-1 min-h-[260px] border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-4 sm:px-5 sm:py-5 mb-5 text-[15px] leading-7 text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition resize-y"
            />

            <div className="shrink-0 mb-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm"><Paperclip size={19} /></span><div><p className="font-semibold text-slate-800">Attachments</p><p className="mt-0.5 text-xs text-slate-500">Add PDF, screenshots, images or videos. Existing files stay attached.</p></div></div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"><Plus size={16} /> Add files<input type="file" multiple accept="application/pdf,image/*,video/*" className="hidden" onChange={(event) => handleFileSelection(event, setEditNoteFiles, (editNoteData.attachments || []).length)} /></label>
              </div>
              {renderAttachments(editNoteData.attachments || [])}
              {renderSelectedFiles(editNoteFiles, setEditNoteFiles)}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100">

              <button
                onClick={() => {
                  setEditingNote(false);

                  setEditNoteData({
                    id: "",
                    title: "",
                    content: "",
                    attachments: [],
                  });
                  setEditNoteFiles([]);
                }}
                className="px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition font-medium"
              >
                Cancel
              </button>

              <button
                onClick={handleUpdateNote}
                disabled={
                  actionLoadingId ===
                  editNoteData.id
                }
                className="px-6 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition disabled:opacity-60 font-semibold"
              >
                {actionLoadingId ===
                editNoteData.id
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* ==================================================
          SMALL NOTE PREVIEW
      ================================================== */}
      {selectedNote &&
        !fullScreenNote && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() =>
              setSelectedNote(null)
            }
          >

            <div
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-7"
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              {/* Header */}
              <div className="flex justify-between items-start">

                <div className="flex-1 pr-4">

                  <h2 className="text-2xl font-bold text-slate-800">
                    {selectedNote.title}
                  </h2>

                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">

                    <span>
                      {selectedNote.category}
                    </span>

                    <span>•</span>

                    <span>
                      {selectedNote.date}
                    </span>

                  </div>

                </div>

                <button
                  onClick={() =>
                    setSelectedNote(null)
                  }
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  <X size={22} />
                </button>

              </div>

              <div className="border-t border-gray-200 my-6"></div>

              {/* Content */}
              <div className="text-slate-700 leading-7 whitespace-pre-wrap max-h-280 overflow-y-auto">
                {selectedNote.description}
              </div>
              {renderAttachments(selectedNote.attachments || [])}

              {/* Actions */}
              <div className="flex flex-wrap justify-end gap-3 mt-8">

                {/* Favorite */}
                <button
                  onClick={() =>
                    handleFavoriteNote(
                      selectedNote.id
                    )
                  }
                  className={`px-4 py-2 rounded-xl transition ${
                    selectedNote.isFavorite
                      ? "bg-yellow-100 text-yellow-600 hover:bg-yellow-200"
                      : "bg-gray-100 text-gray-600 hover:bg-yellow-50"
                  }`}
                >
                  ⭐{" "}
                  {selectedNote.isFavorite
                    ? "Favorite"
                    : "Add Favorite"}
                </button>

                {/* Edit */}
                <button
                  onClick={() =>
                    handleEditNote(
                      selectedNote.id
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                >
                  ✏️ Edit
                </button>

                {/* Archive */}
                {selectedNote.isArchived ? (
                  <button
                    onClick={() =>
                      handleUnarchiveNote(
                        selectedNote.id
                      )
                    }
                    disabled={
                      actionLoadingId ===
                      selectedNote.id
                    }
                    className="px-4 py-2 rounded-xl bg-green-100 text-green-600 hover:bg-green-200 transition disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <ArchiveRestore
                        size={18}
                      />
                      Unarchive
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      handleArchiveNote(
                        selectedNote.id
                      )
                    }
                    disabled={
                      actionLoadingId ===
                      selectedNote.id
                    }
                    className="px-4 py-2 rounded-xl bg-orange-100 text-orange-600 hover:bg-orange-200 transition disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <Archive size={18} />
                      Archive
                    </span>
                  </button>
                )}

                {/* Delete */}
                <button
                  onClick={() =>
                    handleDeleteNote(
                      selectedNote.id
                    )
                  }
                  disabled={
                    actionLoadingId ===
                    selectedNote.id
                  }
                  className="px-4 py-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition disabled:opacity-50"
                >
                  🗑️ Delete
                </button>

                {/* Full Mode */}
                <button
                  onClick={() =>
                    setFullScreenNote(true)
                  }
                  className="px-4 py-2 rounded-xl bg-violet-100 text-violet-600 hover:bg-violet-200 transition font-medium"
                >
                  📖 Full Mode
                </button>

                {/* Close */}
                <button
                  onClick={() =>
                    setSelectedNote(null)
                  }
                  className="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
                >
                  Close
                </button>

              </div>

            </div>
          </div>
        )}

      {/* ==================================================
          SIDEBAR AI ASSISTANT
          Works with or without an open note
      ================================================== */}
      {/* Keep AI tools mounted while switching so their in-memory state is not lost.
          Their drafts are also persisted in localStorage for page reloads. */}
      {!fullScreenNote && (
        <div style={{ display: showAIAssistant ? "block" : "none" }}>
          <AIAssistant
            noteContent={selectedNote?.description || ""}
            noteTitle={selectedNote?.title || ""}
            centered={true}
            onOpenCalendar={handleOpenCalendar}
            onClose={() => setShowAIAssistant(false)}
          />
        </div>
      )}

      <div style={{ display: showAISummary ? "block" : "none" }}>
        <AISummary
          notes={notes}
          selectedNote={selectedNote}
          onClose={() => setShowAISummary(false)}
        />
      </div>

      <div style={{ display: showAIQuiz ? "block" : "none" }}>
        <AIQuiz
          notes={notes}
          selectedNote={selectedNote}
          onClose={() => setShowAIQuiz(false)}
        />
      </div>

      {showCalendar && (
        <CalendarView
          onClose={() => setShowCalendar(false)}
          onEventsChanged={fetchEventReminders}
        />
      )}

      {/* ==================================================
          USER PROFILE MODAL
      ================================================== */}
      {showProfile && (
        <div
          className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setShowProfile(false)}
        >
          <section
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-blue-800 px-6 py-5 text-white">
              <div>
                <p className="text-sm text-blue-100">Account settings</p>
                <h2 className="mt-1 text-2xl font-bold">My Profile</h2>
              </div>
              <button type="button" onClick={() => setShowProfile(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close profile">
                <X size={21} />
              </button>
            </div>

            {loadingProfile ? (
              <div className="p-8 text-center text-slate-500">Loading your profile...</div>
            ) : (
              <div className="space-y-4 p-6">
                <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-blue-700">
                    {profile?.profileImage ? (
                      <img src={profile.profileImage} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound size={28} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-semibold text-slate-900">{profile?.fullName || profile?.name || "Name not available"}</h3>
                    <p className="break-all text-sm text-slate-500">{profile?.email || "Email not available"}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                    <UserRound size={19} className="mt-0.5 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Full name</p>
                      <p className="mt-1 break-words font-medium text-slate-800">{profile?.fullName || profile?.name || "Not available"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                    <Mail size={19} className="mt-0.5 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Email address</p>
                      <p className="mt-1 break-all font-medium text-slate-800">{profile?.email || "Not available"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                    <Fingerprint size={19} className="mt-0.5 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">User ID</p>
                      <p className="mt-1 break-all font-mono text-sm text-slate-700">{profile?._id || "Not available"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                    <ShieldCheck size={19} className="mt-0.5 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Account</p>
                      <p className="mt-1 font-medium text-slate-800">DevFlow OS member</p>
                    </div>
                  </div>
                  {profile?.createdAt && (
                    <p className="px-1 text-xs text-slate-400">
                      Joined {new Date(profile.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>

                <button type="button" onClick={() => setShowProfile(false)} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800">
                  Close Profile
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ==================================================
          FULL SCREEN READING MODE
      ================================================== */}
      {selectedNote &&
        fullScreenNote && (
          <div className="fixed inset-0 bg-slate-100 z-[100] flex flex-col">

            {/* Full Mode Header */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">

              {/* Note Title */}
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-800 truncate">
                  {selectedNote.title}
                </h2>
                <p className="text-xs text-slate-400">
                  Full Mode
                </p>
              </div>

              {/* Only AI + Close */}
              <div className="flex items-center gap-2">

                {/* AI Assistant */}
                <button
                  onClick={handleOpenAIAssistant}
                  className={`p-2.5 rounded-xl transition ${
                    showAIAssistant
                      ? "text-indigo-700 bg-indigo-100"
                      : "text-indigo-600 hover:bg-indigo-50"
                  }`}
                  title="AI Assistant"
                >
                  <Bot size={21} />
                </button>

                {/* Close */}
                <button
                  onClick={() => {
                    setShowAIAssistant(false);
                    setFullScreenNote(false);
                    setSelectedNote(null);
                  }}
                  className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition"
                  title="Close"
                >
                  <X size={22} />
                </button>

              </div>
            </div>

            {/* Main Split Area */}
            <div className="flex flex-1 min-h-0">

              {/* LEFT: NOTE */}
              <div
                className={`${
                  showAIAssistant
                    ? "flex-1 min-w-0"
                    : "w-full"
                } min-h-0 overflow-y-auto bg-slate-100`}
              >

                <article className="max-w-4xl mx-auto px-6 py-12">

                  <div className="flex items-center gap-3 text-sm text-slate-500 mb-5">
                    <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-600">
                      {selectedNote.category}
                    </span>

                    {selectedNote.isArchived && (
                      <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-600">
                        Archived
                      </span>
                    )}

                    <span>•</span>

                    <span>
                      {selectedNote.date}
                    </span>
                  </div>

                  <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
                    {selectedNote.title}
                  </h1>

                  <div className="border-t border-slate-200 my-8" />

                  <div className="text-lg md:text-xl text-slate-700 leading-9 whitespace-pre-wrap">
                    {selectedNote.description}
                  </div>
                  {renderAttachments(selectedNote.attachments || [])}

                  <div className="border-t border-slate-200 mt-12 pt-6">
                    <p className="text-sm text-slate-400">
                      DevFlow OS • Note Reader
                    </p>
                  </div>

                </article>
              </div>

              {/* RIGHT: AI ASSISTANT */}
              {showAIAssistant && (
                <div className="w-[420px] xl:w-[480px] flex-shrink-0 min-h-0 border-l border-slate-200 bg-white">
                  <AIAssistant
                    noteContent={selectedNote.description}
                    noteTitle={selectedNote.title}
                    embedded={true}
                    onOpenCalendar={handleOpenCalendar}
                    onClose={() =>
                      setShowAIAssistant(false)
                    }
                  />
                </div>
              )}

            </div>
          </div>
        )}

      {/* Floating Add Button */}
      {!fullScreenNote && (
          <button
            onClick={() =>
              setShowCreateNote(true)
            }
            className="fixed bottom-8 right-8 bg-orange-500 hover:bg-orange-600 text-white rounded-full p-5 shadow-xl transition hover:scale-110 z-40"
          >
            <Plus size={28} />
          </button>
        )}

    </div>
  );
}

export default Dashboard;