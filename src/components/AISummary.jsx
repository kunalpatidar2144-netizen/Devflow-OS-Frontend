import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Loader2,
  X,
  Search,
  ArrowLeft,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { askAIAssistant } from "../services/aiService";
import { createHistory } from "../services/historyService";

function getDraftStorageKey(baseName) {
  try {
    const userValue = localStorage.getItem("user") || sessionStorage.getItem("user") || "null";
    const user = JSON.parse(userValue);
    const userId = user?._id || user?.id || user?.email || "guest";
    return `${baseName}:${userId}`;
  } catch {
    return `${baseName}:guest`;
  }
}

function readDraft(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function writeDraft(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Could not persist AI workspace draft:", error);
  }
}

function AISummary({
  notes = [],
  selectedNote = null,
  onClose,
}) {
  const [draftKey] = useState(() => getDraftStorageKey("devflow-ai-summary-draft-v1"));
  const [initialDraft] = useState(() => readDraft(draftKey));
  const [selectedForSummary, setSelectedForSummary] =
    useState(() => selectedNote || initialDraft.selectedForSummary || null);

  const [search, setSearch] = useState(() => initialDraft.search || "");
  const [summary, setSummary] = useState(() => initialDraft.summary || "");
  const [loading, setLoading] = useState(false);
  const [showNotePicker, setShowNotePicker] =
    useState(() => typeof initialDraft.showNotePicker === "boolean" ? initialDraft.showNotePicker : !selectedNote);

  const [fullMode, setFullMode] = useState(true);

  useEffect(() => {
    // A null prop means no note was opened from the dashboard; keep the restored draft.
    if (!selectedNote) return;
    const currentId = selectedForSummary?.id || selectedForSummary?._id;
    const incomingId = selectedNote?.id || selectedNote?._id;
    if (currentId && incomingId && String(currentId) === String(incomingId)) return;
    setSelectedForSummary(selectedNote);
    setShowNotePicker(false);
    setSummary("");
  }, [selectedNote]);

  useEffect(() => {
    writeDraft(draftKey, { selectedForSummary, search, summary, showNotePicker });
  }, [draftKey, selectedForSummary, search, summary, showNotePicker]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return notes;
    }

    return notes.filter((note) => {
      const title = note?.title || "";
      const description = note?.description || "";

      return (
        title.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query)
      );
    });
  }, [notes, search]);

  const handleSelectNote = (note) => {
    setSelectedForSummary(note);
    setShowNotePicker(false);
    setSummary("");

  };

  const generateSummary = async () => {
    if (!selectedForSummary?.description?.trim()) {
      toast.warning("This note does not contain enough content to summarize.");
      return;
    }

    setLoading(true);
    setSummary("");

    try {
      const response = await askAIAssistant(
        `Create a clean and easy-to-read summary of the note below.

Requirements:
1. Start with a short summary.
2. Then give the most important points.
3. Keep the explanation simple and useful.
4. Match the language of the note.
5. Do not use fancy symbols or unnecessary emojis.
6. Do not repeat the complete note.

Note:
${selectedForSummary.description}`,
        selectedForSummary.description,
        []
      );

      const generatedSummary =
        response?.data?.answer || "Sorry, I could not generate a summary.";
      setSummary(generatedSummary);
      try {
        await createHistory({
          type: "summary",
          title: selectedForSummary.title || "AI Summary",
          content: generatedSummary,
          metadata: {
            noteTitle: selectedForSummary.title || "Untitled Note",
            noteId: selectedForSummary.id || selectedForSummary._id || "",
          },
        });
        toast.success("Summary saved to History");
      } catch (saveError) {
        console.error("Could not save summary history:", saveError);
        toast.warning("Summary generated, but could not be saved to History.");
      }
    } catch (error) {
      console.error("AI Summary Error:", error);

      toast.error(
        error?.response?.data?.message ||
          "Failed to generate summary"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={
        fullMode
          ? "fixed inset-y-0 left-64 right-0 md:left-72 z-[250] bg-[#202123]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
          : "fixed inset-y-0 left-64 right-0 md:left-72 z-[250] bg-[#202123]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      }
      onClick={onClose}
    >
      <div
        className={
          fullMode
            ? "w-full h-[92vh] max-w-[1440px] max-h-[94vh] rounded-2xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden border border-white/70 flex flex-col"
            : "w-full max-w-5xl max-h-[88vh] rounded-2xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden border border-white/70 flex flex-col"
        }
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#202123] text-white px-5 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <FileText size={21} />
            </div>

            <div className="min-w-0">
              <h2 className="font-semibold">
                AI Summary
              </h2>

              <p className="text-xs text-slate-400 truncate">
                {selectedForSummary?.title ||
                  "Select a note to summarize"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setFullMode((prev) => !prev)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title={fullMode ? "Exit Full Screen" : "Full Screen"}
            >
              {fullMode ? (
                <Minimize2 size={21} />
              ) : (
                <Maximize2 size={21} />
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-300 hover:bg-red-500/20 hover:text-red-200 transition"
              title="Close AI Summary"
              aria-label="Close AI Summary"
            >
              <X size={21} />
            </button>
          </div>
        </div>

        {/* Note Picker */}
        {showNotePicker ? (
          <div className={`p-6 ${fullMode ? "flex-1 min-h-0 flex flex-col" : ""}`}>
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
                title="Back"
              >
                <ArrowLeft size={20} />
              </button>

              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Select a Note
                </h3>

                <p className="text-sm text-slate-500">
                  Choose a note and generate its AI summary.
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search
                size={18}
                className="absolute left-3 top-3 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search notes..."
                className="w-full border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Notes */}
            <div
              className={`overflow-y-auto space-y-2 pr-1 ${
                fullMode ? "flex-1 min-h-0" : "max-h-[52vh]"
              }`}
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "#cbd5e1 transparent",
              }}
            >
              {filteredNotes.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  No notes found.
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <button
                    key={note._id || note.id}
                    onClick={() => handleSelectNote(note)}
                    className={`w-full text-left p-4 rounded-2xl border transition ${
                      selectedForSummary?._id === note._id ||
                      selectedForSummary?.id === note.id
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <FileText size={19} />
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-semibold text-slate-900 truncate">
                          {note.title || "Untitled Note"}
                        </h4>

                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                          {note.description || "No content"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Summary */
          <div className={`p-6 ${fullMode ? "flex-1 min-h-0 flex flex-col" : ""}`}>
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => {
                  setShowNotePicker(true);
                  setSummary("");
                }}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Change Note
              </button>

              {!summary && !loading && (
                <button
                  onClick={generateSummary}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium"
                >
                  Generate Summary
                </button>
              )}
            </div>

            {loading ? (
              <div className="min-h-[300px] flex flex-col items-center justify-center text-slate-500">
                <Loader2
                  size={30}
                  className="animate-spin text-indigo-600 mb-3"
                />

                <p>Generating summary...</p>
              </div>
            ) : summary ? (
              <div
                className={`overflow-y-auto pr-2 text-slate-700 leading-7 whitespace-pre-wrap ${
                  fullMode ? "flex-1 min-h-0" : "max-h-[58vh]"
                }`}
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "#cbd5e1 transparent",
                }}
              >
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  Summary
                </h3>

                <p>{summary}</p>
              </div>
            ) : (
              <div className="min-h-[260px] rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
                  <FileText size={25} />
                </div>

                <h3 className="text-lg font-semibold text-slate-900">
                  Ready to summarize
                </h3>

                <p className="text-sm text-slate-500 mt-2 max-w-md">
                  Generate a simple summary and the important points from this note.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AISummary;