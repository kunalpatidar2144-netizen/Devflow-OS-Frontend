import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  Loader2,
  X,
  Search,
  ArrowLeft,
  Maximize2,
  Minimize2,
  CheckCircle2,
  CircleCheck,
  RotateCcw,
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

function AIQuiz({ notes = [], selectedNote = null, onClose }) {
  const [draftKey] = useState(() => getDraftStorageKey("devflow-ai-quiz-draft-v1"));
  const [initialDraft] = useState(() => readDraft(draftKey));
  const [selectedForQuiz, setSelectedForQuiz] = useState(() => selectedNote || initialDraft.selectedForQuiz || null);
  const [search, setSearch] = useState(() => initialDraft.search || "");
  const [showPicker, setShowPicker] = useState(() => typeof initialDraft.showPicker === "boolean" ? initialDraft.showPicker : !selectedNote);
  const [quiz, setQuiz] = useState(() => Array.isArray(initialDraft.quiz) ? initialDraft.quiz : []);
  const [answers, setAnswers] = useState(() => initialDraft.answers || {});
  const [currentIndex, setCurrentIndex] = useState(() => Number.isInteger(initialDraft.currentIndex) ? initialDraft.currentIndex : 0);
  const [started, setStarted] = useState(() => Boolean(initialDraft.started));
  const [finished, setFinished] = useState(() => Boolean(initialDraft.finished));
  const [loading, setLoading] = useState(false);
  const [fullMode, setFullMode] = useState(true);
  const savedQuizSignature = useRef(initialDraft.savedQuizSignature || "");

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return notes;

    return notes.filter((note) =>
      `${note?.title || ""} ${note?.description || ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [notes, search]);

  const getQuestionCount = (content = "") => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    if (words <= 100) return 3;
    if (words <= 250) return 5;
    if (words <= 500) return 7;
    if (words <= 900) return 10;
    if (words <= 1400) return 13;
    if (words <= 2000) return 16;
    return 20;
  };

  const parseQuiz = (answer) => {
    try {
      const cleaned = answer
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.questions)
        ? parsed.questions
        : [];
    } catch {
      const match = answer.match(/\[[\s\S]*\]/);
      if (!match) return [];

      try {
        const parsed = JSON.parse(match[0]);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
  };

  const normalizeQuiz = (items) =>
    items
      .map((item, index) => {
        const options = Array.isArray(item.options)
          ? item.options.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 4)
          : [];

        let correctIndex = Number(item.correctIndex);

        if (
          !Number.isInteger(correctIndex) ||
          correctIndex < 0 ||
          correctIndex >= options.length
        ) {
          const correctAnswer = String(item.correctAnswer || "").trim().toLowerCase();
          correctIndex = options.findIndex(
            (option) => option.toLowerCase() === correctAnswer
          );
        }

        if (!item.question || options.length !== 4 || correctIndex < 0) {
          return null;
        }

        return {
          id: `${index}-${item.question}`,
          question: String(item.question).trim(),
          options,
          correctIndex,
        };
      })
      .filter(Boolean);

  const selectNote = (note) => {
    setSelectedForQuiz(note);
    setShowPicker(false);
    setQuiz([]);
    setAnswers({});
    setCurrentIndex(0);
    setStarted(false);
    setFinished(false);
  };

  const generateQuiz = async () => {
    if (!selectedForQuiz?.description?.trim()) {
      toast.warning("This note does not contain enough content for a quiz.");
      return;
    }

    const count = getQuestionCount(selectedForQuiz.description);
    setLoading(true);

    try {
      const prompt = `Create a multiple-choice quiz ONLY from the note below.

Generate approximately ${count} questions based on the amount and depth of the content.
Shorter notes should produce fewer questions and detailed notes should produce more.

Rules:
- Use only information supported by the note.
- Cover different important concepts.
- Do not duplicate questions.
- Every question must have exactly 4 options.
- Only one option is correct.
- Return ONLY valid JSON. No markdown or explanation.

Return exactly:
[
  {
    "question": "Question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0
  }
]

NOTE:
${selectedForQuiz.description}`;

      const response = await askAIAssistant(
        prompt,
        selectedForQuiz.description,
        []
      );

      const generated = normalizeQuiz(
        parseQuiz(response?.data?.answer || "")
      );

      if (!generated.length) {
        throw new Error("The AI returned an invalid quiz format.");
      }

      savedQuizSignature.current = "";
      setQuiz(generated.slice(0, 20));
      setAnswers({});
      setCurrentIndex(0);
      setFinished(false);
      setStarted(true);
    } catch (error) {
      console.error("AI Quiz Error:", error);
      toast.error(
        error?.response?.data?.message ||
        error?.message ||
        "Failed to generate quiz"
      );
    } finally {
      setLoading(false);
    }
  };

  const chooseAnswer = (index) => {
    if (finished) return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: index }));
  };

  // Persist in-progress questions and answers so switching tools or refreshing does not reset the quiz.
  useEffect(() => {
    writeDraft(draftKey, {
      selectedForQuiz, search, showPicker, quiz, answers, currentIndex, started, finished,
      savedQuizSignature: savedQuizSignature.current,
    });
  }, [draftKey, selectedForQuiz, search, showPicker, quiz, answers, currentIndex, started, finished]);

  const score = quiz.reduce(
    (total, question, index) =>
      total + (answers[index] === question.correctIndex ? 1 : 0),
    0
  );

  useEffect(() => {
    if (!finished || !quiz.length) return;
    const signature = JSON.stringify({ quiz, answers, note: selectedForQuiz?.title || "" });
    if (savedQuizSignature.current === signature) return;
    savedQuizSignature.current = signature;
    const correct = score;
    const totalQuestions = quiz.length;
    const wrong = totalQuestions - correct;
    const percentage = Math.round((correct / totalQuestions) * 100);
    createHistory({
      type: "quiz",
      title: `${selectedForQuiz?.title || "AI Quiz"} — ${percentage}% (${new Date().toLocaleString("en-IN")})`,
      content: `Quiz result: ${correct}/${totalQuestions}`,
      metadata: {
        attemptId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        attemptedAt: new Date().toISOString(),
        noteTitle: selectedForQuiz?.title || "Selected Note",
        totalQuestions,
        correct,
        wrong,
        percentage,
        totalMarks: totalQuestions,
        obtainedMarks: correct,
        answers,
        questions: quiz,
      },
    }).then(() => {
      savedQuizSignature.current = signature;
      writeDraft(draftKey, { selectedForQuiz, search, showPicker, quiz, answers, currentIndex, started, finished, savedQuizSignature: signature });
      toast.success("Quiz result saved to Quiz Results history");
    }).catch((error) => {
      console.error("Could not save quiz result:", error);
      toast.warning("Quiz completed, but result could not be saved to History.");
    });
  }, [finished, quiz, answers, selectedForQuiz, score, draftKey, search, showPicker, currentIndex, started]);

  const restartQuiz = () => {
    savedQuizSignature.current = "";
    setQuiz([]);
    setAnswers({});
    setCurrentIndex(0);
    setStarted(false);
    setFinished(false);
  };

  const closeButton = () => {
    onClose();
  };

  const currentQuestion = quiz[currentIndex];

  return (
    <div
      className={
        fullMode
          ? "fixed inset-y-0 left-64 right-0 md:left-72 z-[260] bg-[#202123]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
          : "fixed inset-y-0 left-64 right-0 md:left-72 z-[260] bg-[#202123]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      }
      onClick={onClose}
    >
      <div
        className={
          fullMode
            ? "w-full h-[92vh] max-w-[1440px] max-h-[94vh] rounded-2xl sm:rounded-3xl bg-white flex flex-col overflow-hidden shadow-2xl border border-white/70"
            : "w-full max-w-5xl max-h-[88vh] rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-white/70 flex flex-col overflow-hidden"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 bg-[#202123] text-white px-5 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Brain size={21} />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold">AI Quiz</h2>
              <p className="text-xs text-slate-400 truncate">
                {selectedForQuiz?.title || "Select a note"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setFullMode((prev) => !prev)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title={fullMode ? "Exit Full Screen" : "Full Screen"}
            >
              {fullMode ? <Minimize2 size={21} /> : <Maximize2 size={21} />}
            </button>

            <button
              onClick={closeButton}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Close AI Quiz"
              aria-label="Close AI Quiz"
            >
              <X size={21} />
            </button>
          </div>
        </div>

        {showPicker ? (
          <div className="flex-1 min-h-0 flex flex-col p-6">
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Select a Note
                </h3>
                <p className="text-sm text-slate-500">
                  Choose a note to create a content-based quiz.
                </p>
              </div>
            </div>

            <div className="relative mb-4">
              <Search size={18} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes..."
                className="w-full border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div
              className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
            >
              {filteredNotes.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  No notes found.
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <button
                    key={note._id || note.id}
                    onClick={() => selectNote(note)}
                    className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition"
                  >
                    <h4 className="font-semibold text-slate-900 truncate">
                      {note.title || "Untitled Note"}
                    </h4>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                      {note.description || "No content"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Loader2 size={34} className="animate-spin text-indigo-600 mb-4" />
            <p className="font-medium">Creating your quiz...</p>
            <p className="text-sm mt-1">
              Questions are being generated from your note.
            </p>
          </div>
        ) : !started ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-xl text-center">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                <Brain size={36} />
              </div>

              <h3 className="text-2xl font-bold text-slate-900">
                Ready for your quiz?
              </h3>

              <p className="text-slate-500 mt-2">
                The number of questions will depend on the amount and depth of the note.
              </p>

              <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-5 text-left">
                <p className="text-sm text-slate-500">Note</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {selectedForQuiz?.title || "Selected Note"}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Estimated questions
                  </span>
                  <span className="font-semibold text-indigo-600">
                    {getQuestionCount(selectedForQuiz?.description || "")}
                  </span>
                </div>
              </div>

              <button
                onClick={generateQuiz}
                className="mt-6 px-6 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
              >
                Generate Quiz
              </button>

              <button
                onClick={() => setShowPicker(true)}
                className="mx-auto mt-8 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition"
              >
                Change Note
              </button>
            </div>
          </div>
        ) : finished ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto text-center pt-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <CheckCircle2 size={38} />
              </div>

              <h3 className="text-3xl font-bold text-slate-900 mt-5">
                Quiz Complete
              </h3>

              <p className="text-slate-500 mt-2">You scored</p>

              <div className="text-5xl font-bold text-indigo-600 mt-2">
                {score}/{quiz.length}
              </div>

              <p className="text-slate-500 mt-2">
                {Math.round((score / quiz.length) * 100)}% correct
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 text-left">
                {[["Total Marks", quiz.length], ["Obtained", score], ["Correct", score], ["Wrong", quiz.length - score]].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-center gap-3">
                <button
                  onClick={restartQuiz}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  New Quiz
                </button>

                <button
                  onClick={onClose}
                  className="px-5 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : currentQuestion ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <div
              className="flex-1 overflow-y-auto p-6"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
            >
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-500">
                    Question {currentIndex + 1} of {quiz.length}
                  </span>
                  <span className="text-sm font-medium text-indigo-600">
                    {Math.round(((currentIndex + 1) / quiz.length) * 100)}%
                  </span>
                </div>

                <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-8">
                  <div
                    className="h-full bg-indigo-600 transition-all"
                    style={{
                      width: `${((currentIndex + 1) / quiz.length) * 100}%`,
                    }}
                  />
                </div>

                <h3 className="text-2xl font-bold text-slate-900 leading-9">
                  {currentQuestion.question}
                </h3>

                <div className="mt-7 flex flex-col gap-3">
                  {currentQuestion.options.map((option, index) => {
                    const selected = answers[currentIndex] === index;

                    return (
                      <button
                        key={index}
                        onClick={() => chooseAnswer(index)}
                        className={`w-full text-left px-5 py-4 rounded-2xl border transition ${
                          selected
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-5">
                          <span
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              selected
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {selected && <CircleCheck size={17} />}
                          </span>

                          <span className="text-slate-800 leading-6 flex-1">
                            {option}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-slate-200 p-4 bg-white">
              <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => i - 1)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Previous
                </button>

                {currentIndex === quiz.length - 1 ? (
                  <button
                    disabled={answers[currentIndex] === undefined}
                    onClick={() => setFinished(true)}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition"
                  >
                    Finish Quiz
                  </button>
                ) : (
                  <button
                    disabled={answers[currentIndex] === undefined}
                    onClick={() => setCurrentIndex((i) => i + 1)}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default AIQuiz;