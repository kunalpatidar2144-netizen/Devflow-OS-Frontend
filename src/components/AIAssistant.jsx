import { useCallback, useEffect, useRef, useState } from "react";

import {

  Bot,

  Send,

  X,

  Loader2,

  User,

  Maximize2,

  Minimize2,

  Plus,

  History as HistoryIcon,

  Pin,

  ImagePlus,

  Mic,

  MicOff,

  Moon,

  Sun,
  Copy,
  Trash2,

} from "lucide-react";

import { toast } from "sonner";



import { askAIAssistant } from "../services/aiService";

import { getHistory, createHistory, updateHistory, deleteHistory } from "../services/historyService";



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

    return JSON.parse(sessionStorage.getItem(key) || "{}");

  } catch {

    return {};

  }

}



function writeDraft(key, value) {

  try {

    // Keep the active chat for this login session only. Saved conversations are

    // stored separately by the backend and remain available in Chat History.

    sessionStorage.setItem(key, JSON.stringify(value));

  } catch (error) {

    console.warn("Could not persist AI workspace draft:", error);

  }

}



// A small, safe Markdown renderer for readable AI responses. It renders text as

// React elements instead of injecting raw HTML.

function renderInlineMarkdown(text, dark = false) {

  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;

  return String(text).split(tokenPattern).filter(Boolean).map((part, index) => {

    if (part.startsWith("**") && part.endsWith("**")) {

      return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;

    }

    if (part.startsWith("`") && part.endsWith("`")) {

      return <code key={index} className={`rounded px-1.5 py-0.5 font-mono text-[0.9em] ${dark ? "bg-slate-700 text-indigo-200" : "bg-slate-100 text-rose-700"}`}>{part.slice(1, -1)}</code>;

    }

    if (part.startsWith("*") && part.endsWith("*")) {

      return <em key={index}>{part.slice(1, -1)}</em>;

    }

    return <span key={index}>{part}</span>;

  });

}



function renderMarkdown(content, dark = false) {

  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");

  const blocks = [];

  let paragraph = [];

  let listItems = [];

  let listType = null;

  let codeLines = [];

  let inCode = false;



  const flushParagraph = () => {

    if (!paragraph.length) return;

    blocks.push(<p key={`p-${blocks.length}`} className="my-2 leading-7">{paragraph.map((line, i) => <span key={i}>{i > 0 ? " " : ""}{renderInlineMarkdown(line, dark)}</span>)}</p>);

    paragraph = [];

  };

  const flushList = () => {

    if (!listItems.length) return;

    const items = listItems.map((item, i) => <li key={i} className="my-1 pl-1 leading-7">{renderInlineMarkdown(item, dark)}</li>);

    blocks.push(listType === "ol"

      ? <ol key={`ol-${blocks.length}`} className="my-3 list-decimal space-y-1 pl-6">{items}</ol>

      : <ul key={`ul-${blocks.length}`} className="my-3 list-disc space-y-1 pl-6">{items}</ul>);

    listItems = [];

    listType = null;

  };



  lines.forEach((line) => {

    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {

      flushParagraph(); flushList();

      if (inCode) {

        blocks.push(<pre key={`code-${blocks.length}`} className={`my-3 overflow-x-auto rounded-xl p-4 text-sm leading-6 ${dark ? "bg-[#0b0f19] text-slate-100" : "bg-slate-900 text-slate-100"}`}><code>{codeLines.join("\n")}</code></pre>);

        codeLines = [];

        inCode = false;

      } else {

        inCode = true;

      }

      return;

    }

    if (inCode) { codeLines.push(line); return; }

    if (!trimmed) { flushParagraph(); flushList(); return; }



    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);

    if (heading) {

      flushParagraph(); flushList();

      const level = heading[1].length;

      const cls = level === 1 ? "mt-5 mb-3 text-2xl font-bold tracking-tight" : level === 2 ? "mt-5 mb-2 text-xl font-bold tracking-tight" : level === 3 ? "mt-4 mb-2 text-lg font-semibold" : "mt-3 mb-1 text-base font-semibold";

      blocks.push(<div key={`h-${blocks.length}`} className={cls}>{renderInlineMarkdown(heading[2], dark)}</div>);

      return;

    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) { flushParagraph(); flushList(); blocks.push(<hr key={`hr-${blocks.length}`} className={`my-4 ${dark ? "border-slate-700" : "border-slate-200"}`} />); return; }



    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);

    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (bullet || ordered) {

      flushParagraph();

      const nextType = ordered ? "ol" : "ul";

      if (listType && listType !== nextType) flushList();

      listType = nextType;

      listItems.push((bullet || ordered)[1]);

      return;

    }

    flushList();

    const quote = trimmed.match(/^>\s?(.*)$/);

    if (quote) {

      flushParagraph();

      blocks.push(<blockquote key={`q-${blocks.length}`} className={`my-3 border-l-4 pl-4 italic ${dark ? "border-indigo-400 text-slate-300" : "border-indigo-300 text-slate-600"}`}>{renderInlineMarkdown(quote[1], dark)}</blockquote>);

      return;

    }

    paragraph.push(trimmed);

  });

  flushParagraph(); flushList();

  if (inCode) blocks.push(<pre key={`code-${blocks.length}`} className={`my-3 overflow-x-auto rounded-xl p-4 text-sm leading-6 ${dark ? "bg-[#0b0f19] text-slate-100" : "bg-slate-900 text-slate-100"}`}><code>{codeLines.join("\n")}</code></pre>);

  return <div className="ai-markdown min-w-0 break-words">{blocks}</div>;

}



function AIAssistant({

  noteContent,

  noteTitle,

  onClose,

  embedded = false,

  centered = false,

}) {

  const [draftKey, setDraftKey] = useState(() => getDraftStorageKey("devflow-ai-assistant-draft-v1"));

  const [initialDraft] = useState(() => readDraft(draftKey));

  // A new login starts clean; within this login, the active chat is preserved

  // when switching views or remounting the assistant. Saved chats stay in History.

  const [question, setQuestion] = useState(() => initialDraft.question || "");

  const [messages, setMessages] = useState(() => Array.isArray(initialDraft.messages) ? initialDraft.messages : []);
  const [activeMessageMenu, setActiveMessageMenu] = useState(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState(null);

  const [loading, setLoading] = useState(false);

  const [fullMode, setFullMode] = useState(!embedded);

  const [historyItems, setHistoryItems] = useState([]);

  const [currentHistoryId, setCurrentHistoryId] = useState(() => initialDraft.currentHistoryId || null);

  const [currentPinned, setCurrentPinned] = useState(() => Boolean(initialDraft.currentPinned));

  const [showChatHistory, setShowChatHistory] = useState(false);

  const [imageData, setImageData] = useState(() => initialDraft.imageData || "");

  const [imageName, setImageName] = useState(() => initialDraft.imageName || "");

  const [savingHistory, setSavingHistory] = useState(false);

  const [isListening, setIsListening] = useState(false);

  const [darkTheme, setDarkTheme] = useState(() => localStorage.getItem("devflow-ai-dark-theme") === "true");

  const recognitionRef = useRef(null);

  const imageInputRef = useRef(null);



  const refreshChatHistory = useCallback(async () => {

    try {

      const response = await getHistory({ type: "assistant" });

      setHistoryItems(response.data.items || []);

    } catch (error) {

      console.error("Could not load assistant history:", error);

    }

  }, []);



  // A successful login starts a fresh active chat. Saved chats remain in backend History.
  useEffect(() => {
    const handleNewLogin = () => {
      const nextDraftKey = getDraftStorageKey("devflow-ai-assistant-draft-v1");
      setDraftKey(nextDraftKey);
      setQuestion("");
      setMessages([]);
      setCurrentHistoryId(null);
      setCurrentPinned(false);
      setImageData("");
      setImageName("");
      setShowChatHistory(false);
      setLoading(false);
      setSavingHistory(false);
      refreshChatHistory();
    };

    window.addEventListener("devflow:new-login", handleNewLogin);
    return () => window.removeEventListener("devflow:new-login", handleNewLogin);
  }, [refreshChatHistory]);

  useEffect(() => { refreshChatHistory(); }, [refreshChatHistory]);



  // Keep the active draft during this login session; logout clears this session draft.

  useEffect(() => {

    writeDraft(draftKey, {

      question,

      messages,

      currentHistoryId,

      currentPinned,

      imageData,

      imageName,

    });

  }, [draftKey, question, messages, currentHistoryId, currentPinned, imageData, imageName]);



  useEffect(() => {

    localStorage.setItem("devflow-ai-dark-theme", String(darkTheme));

  }, [darkTheme]);



  const startNewChat = () => {

    setMessages([]);

    setQuestion("");

    setCurrentHistoryId(null);

    setCurrentPinned(false);

    setImageData("");

    setImageName("");

    setShowChatHistory(false);

  };



  const openSavedChat = (item) => {

    setMessages(item.messages || []);

    setCurrentHistoryId(item._id);

    setCurrentPinned(Boolean(item.pinned));

    setQuestion("");

    setImageData("");

    setImageName("");

    setShowChatHistory(false);

  };



  const copyQuestion = async (content) => {
    try {
      await navigator.clipboard.writeText(String(content || ""));
      toast.success("Question copied");
    } catch {
      toast.error("Could not copy. Please select and copy the text manually.");
    }
    setActiveMessageMenu(null);
  };

  const deleteQuestion = async (messageIndex) => {
    const questionMessage = messages[messageIndex];
    if (!questionMessage || questionMessage.role !== "user") return;

    const nextMessages = messages.filter((message, index) => {
      if (index === messageIndex) return false;
      // Delete the AI answer directly following the selected question too.
      if (index === messageIndex + 1 && message.role === "assistant") return false;
      return true;
    });
    setMessages(nextMessages);
    setActiveMessageMenu(null);
    setPendingDeleteIndex(null);

    try {
      if (currentHistoryId) {
        if (nextMessages.length === 0) {
          await deleteHistory(currentHistoryId);
          setCurrentHistoryId(null);
          setCurrentPinned(false);
          toast.success("Question and chat deleted");
        } else {
          const firstUserMessage = nextMessages.find((message) => message.role === "user");
          await updateHistory(currentHistoryId, {
            type: "assistant",
            title: (firstUserMessage?.content || "New Chat").slice(0, 80),
            messages: nextMessages,
            pinned: currentPinned,
          });
          toast.success("Question and answer deleted");
        }
        await refreshChatHistory();
      } else {
        toast.success("Question and answer deleted");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Deleted from this chat, but could not sync history");
    }
  };

  const toggleCurrentPin = async () => {

    if (!currentHistoryId) {

      toast.message("Send a message first to save and pin this chat.");

      return;

    }

    try {

      const response = await updateHistory(currentHistoryId, { pinned: !currentPinned });

      setCurrentPinned(Boolean(response.data.item.pinned));

      await refreshChatHistory();

      toast.success(response.data.item.pinned ? "Chat pinned" : "Chat unpinned");

    } catch (error) {

      toast.error(error.response?.data?.message || "Could not update pin");

    }

  };



  // Speech-to-text using the browser Web Speech API.

  const toggleVoiceInput = () => {

    if (isListening) {

      recognitionRef.current?.stop();

      setIsListening(false);

      return;

    }



    const SpeechRecognition =

      window.SpeechRecognition || window.webkitSpeechRecognition;



    if (!SpeechRecognition) {

      toast.error("Voice input is not supported in this browser. Try Chrome or Edge.");

      return;

    }



    try {

      const recognition = new SpeechRecognition();

      recognition.lang = "en-IN";

      recognition.continuous = true;

      recognition.interimResults = true;

      recognitionRef.current = recognition;



      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event) => {

        let finalTranscript = "";

        let interimTranscript = "";



        for (let i = event.resultIndex; i < event.results.length; i += 1) {

          const transcript = event.results[i][0]?.transcript || "";

          if (event.results[i].isFinal) finalTranscript += transcript;

          else interimTranscript += transcript;

        }



        if (finalTranscript.trim()) {

          setQuestion((current) =>

            `${current}${current.trim() ? " " : ""}${finalTranscript.trim()}`

          );

        }

        // Interim text is shown in a toast only when there is no final result yet.

        if (interimTranscript.trim() && !finalTranscript.trim()) {

          // No state update here, avoiding repeated interim text in the input.

        }

      };

      recognition.onerror = (event) => {

        setIsListening(false);

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {

          toast.error("Microphone permission denied. Allow microphone access in your browser settings.");

        } else if (event.error !== "aborted" && event.error !== "no-speech") {

          toast.error(`Voice input error: ${event.error}`);

        }

      };

      recognition.onend = () => setIsListening(false);

      recognition.start();

    } catch (error) {

      setIsListening(false);

      toast.error("Could not start the microphone. Please check browser permission.");

    }

  };



  useEffect(() => {

    return () => {

      try {

        recognitionRef.current?.stop();

      } catch {

        // Recognition may already be stopped.

      }

    };

  }, []);



  const handleImagePick = (event) => {

    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {

      toast.warning("Please choose an image file.");

      event.target.value = "";

      return;

    }

    if (file.size > 1024 * 1024) {

      toast.warning("Image must be 1 MB or smaller.");

      event.target.value = "";

      return;

    }

    const reader = new FileReader();

    reader.onload = () => {

      setImageData(String(reader.result || ""));

      setImageName(file.name);

    };

    reader.readAsDataURL(file);

  };



  const chatEndRef = useRef(null);



  // Keep the latest message visible.

  useEffect(() => {

    chatEndRef.current?.scrollIntoView({

      behavior: "smooth",

    });

  }, [messages, loading]);



  // =========================

  // Ask AI

  // =========================

  const handleAsk = async () => {

    if ((!question.trim() && !imageData) || loading) return;



    const userQuestion = question.trim() || "Please describe or analyze this image.";

    const attachedImage = imageData;

    const userMessage = {

      role: "user",

      content: userQuestion,

      ...(attachedImage ? { imageData: attachedImage, imageName } : {}),

      createdAt: new Date().toISOString(),

    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);

    setQuestion("");

    setImageData("");

    setImageName("");

    setLoading(true);



    try {

      const previousMessages = messages.map((message) => ({

        role: message.role,

        content: message.content,

      }));

      let response;
      try {
        response = await askAIAssistant(userQuestion, noteContent, previousMessages, attachedImage);
      } catch (error) {
        console.error("AI Assistant request failed", {
          message: error?.message,
          status: error?.response?.status,
          response: error?.response?.data,
          apiBaseURL: error?.config?.baseURL,
          requestURL: error?.config?.url,
        });
        setMessages(messages);
        setQuestion(userQuestion);
        const serverMessage = error?.response?.data?.message;
        const networkMessage = !error?.response
          ? `Cannot reach the backend API (${error?.config?.baseURL || "API URL unknown"}). Check that the backend is running on the configured port.`
          : serverMessage || `AI request failed (HTTP ${error.response.status}).`;
        toast.error(networkMessage);
        return;
      }

      const answer = response?.data?.answer || "Sorry, I could not generate an answer.";
      const completeMessages = [
        ...nextMessages,
        { role: "assistant", content: answer, createdAt: new Date().toISOString() },
      ];
      setMessages(completeMessages);

      // AI answers should remain visible even if the separate History API is unavailable.
      const firstUserMessage = completeMessages.find((message) => message.role === "user");
      const title = (firstUserMessage?.content || "New Chat").slice(0, 80);
      setSavingHistory(true);
      const payload = { type: "assistant", title, messages: completeMessages, pinned: currentPinned };
      try {
        const saved = currentHistoryId
          ? await updateHistory(currentHistoryId, payload)
          : await createHistory(payload);
        setCurrentHistoryId(saved.data.item._id);
        setCurrentPinned(Boolean(saved.data.item.pinned));
        await refreshChatHistory();
      } catch (historyError) {
        console.error("AI answered, but chat history could not be saved:", historyError);
        toast.warning("Answer generated, but this conversation could not be saved to History.");
      }
    } catch (error) {
      console.error("Unexpected AI Assistant error:", error);
      toast.error(error?.response?.data?.message || error?.message || "Something went wrong in AI Assistant.");
    } finally {
      setLoading(false);
      setSavingHistory(false);
    }

  };



  // =========================

  // Enter to send

  // =========================

  const handleKeyDown = (e) => {

    if (e.key === "Enter" && !e.shiftKey) {

      e.preventDefault();

      handleAsk();

    }

  };



  const selectQuestion = (text) => {

    setQuestion(text);

  };



  // =========================

  // Panel

  // =========================

  return (

    <div

      className={

        fullMode

          ? "fixed inset-y-0 left-64 right-0 md:left-72 z-[300] bg-[#202123]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"

          : embedded

          ? darkTheme ? "w-full h-full min-h-0 flex flex-col bg-[#171717]" : "w-full h-full min-h-0 flex flex-col bg-white"

          : centered

          ? "fixed inset-y-0 left-64 right-0 md:left-72 z-[200] bg-[#202123]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"

          : "fixed inset-y-0 left-64 right-0 md:left-72 z-[200] bg-[#202123]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"

      }

    >

      <div

        className={

          fullMode

            ? darkTheme ? "w-full h-full max-w-[1440px] max-h-[94vh] rounded-2xl sm:rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden bg-[#171717]" : "w-full h-full max-w-[1440px] max-h-[94vh] rounded-2xl sm:rounded-3xl border border-white/70 shadow-2xl flex flex-col overflow-hidden bg-white"

            : embedded

            ? (darkTheme ? "w-full h-full min-h-0 flex flex-col overflow-hidden bg-[#171717]" : "w-full h-full min-h-0 flex flex-col overflow-hidden bg-white")

            : centered

            ? darkTheme ? "w-full max-w-[1440px] h-[92vh] max-h-[94vh] rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden bg-[#171717] shadow-2xl border border-slate-700" : "w-full max-w-[1440px] h-[92vh] max-h-[94vh] rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden bg-white shadow-2xl border border-white/70"

            : darkTheme ? "w-full h-[92vh] max-w-[1440px] max-h-[94vh] rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden bg-[#171717] shadow-2xl border border-slate-700" : "w-full h-[92vh] max-w-[1440px] max-h-[94vh] rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden bg-white shadow-2xl border border-white/70"

        }

      >

        {/* =========================

            HEADER

        ========================= */}

        <div

          className={`flex-shrink-0 bg-[#202123] text-white px-5 py-4 flex items-center justify-between ${

            centered ? "rounded-t-3xl" : ""

          }`}

        >

          <div className="flex items-center gap-3 min-w-0">

            <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center">

              <Bot size={22} />

            </div>



            <div className="min-w-0">

              <h2 className="text-base font-semibold">

                AI Assistant

              </h2>



              <p className="text-xs text-slate-400 truncate">

                {noteTitle

                  ? `Reading: ${noteTitle}`

                  : "Ask me anything"}

              </p>

            </div>

          </div>



          <div className="flex items-center gap-1">

            <button onClick={startNewChat} title="New Chat" className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"><Plus size={19} /></button>

            <button onClick={() => setShowChatHistory((value) => !value)} title="Chat History" className={`p-2 rounded-lg transition ${showChatHistory ? "bg-slate-700 text-white" : "text-slate-300 hover:text-white hover:bg-slate-800"}`}><HistoryIcon size={19} /></button>

            <button onClick={toggleCurrentPin} title={currentPinned ? "Unpin Chat" : "Pin Chat"} className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"><Pin size={18} className={currentPinned ? "text-amber-300" : ""} /></button>

            <button

              type="button"

              onClick={() => setDarkTheme((value) => !value)}

              title={darkTheme ? "Switch to light theme" : "Switch to dark theme"}

              aria-label={darkTheme ? "Switch to light theme" : "Switch to dark theme"}

              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"

            >

              {darkTheme ? <Sun size={19} /> : <Moon size={19} />}

            </button>

            <button

              onClick={() => setFullMode((prev) => !prev)}

              title={fullMode ? "Exit Full Screen" : "Full Screen"}

              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"

            >

              {fullMode ? (

                <Minimize2 size={20} />

              ) : (

                <Maximize2 size={20} />

              )}

            </button>



            <button

              onClick={onClose}

              title="Close AI Assistant"

              aria-label="Close AI Assistant"

              className="p-2 rounded-lg text-slate-300 hover:bg-red-500/20 hover:text-red-200 transition"

            >

              <X size={21} />

            </button>

          </div>

        </div>



        {showChatHistory && (

          <div className={`flex-shrink-0 max-h-52 overflow-y-auto border-b p-3 ${darkTheme ? "border-slate-700 bg-[#202123]" : "border-slate-200 bg-white"}`}>

            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Saved chats</p>

            {historyItems.length === 0 ? <p className={`px-1 py-3 text-sm ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Your saved conversations will appear here.</p> : historyItems.map((item) => (

              <button key={item._id} onClick={() => openSavedChat(item)} className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${currentHistoryId === item._id ? (darkTheme ? "bg-indigo-950 text-indigo-200" : "bg-indigo-50 text-indigo-700") : (darkTheme ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-50")}`}>

                {item.pinned ? <Pin size={14} className="shrink-0 text-amber-500" /> : <HistoryIcon size={14} className="shrink-0 text-slate-400" />}

                <span className="truncate">{item.title || "Untitled chat"}</span>

              </button>

            ))}

          </div>

        )}



        {/* =========================

            CHAT AREA

        ========================= */}

        <div

          className={`flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 ${darkTheme ? "bg-[#212121]" : "bg-[#f7f7f8]"}`}

          style={{

            scrollbarWidth: "thin",

            scrollbarColor: darkTheme ? "#475569 transparent" : "#cbd5e1 transparent",

          }}

        >

          {messages.length === 0 ? (

            <div className="h-full flex items-center justify-center">

              <div className="w-full max-w-sm text-center">

                <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 shadow-sm">

                  <Bot size={30} />

                </div>



                <h3 className={`text-lg font-semibold ${darkTheme ? "text-slate-100" : "text-slate-800"}`}>

                  {noteContent

                    ? "Ask about this note"

                    : "How can I help you?"}

                </h3>



                <p className={`text-sm mt-2 leading-6 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>

                  {noteContent

                    ? "Ask a question, request an explanation, or ask for an example."

                    : "Ask anything about coding, study, ideas, or any topic you want to explore."}

                </p>



                <div className="mt-5 space-y-2">

                  <button

                    onClick={() =>

                      selectQuestion(

                        noteContent

                          ? "Explain this note in simple language."

                          : "Explain React in simple language."

                      )

                    }

                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition ${darkTheme ? "border-slate-700 bg-[#2b2b2b] text-slate-300 hover:bg-slate-800 hover:border-indigo-500" : "border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:border-indigo-300"}`}

                  >

                    {noteContent

                      ? "Explain this note simply"

                      : "Explain React simply"}

                  </button>



                  <button

                    onClick={() =>

                      selectQuestion(

                        noteContent

                          ? "What are the important points in this note?"

                          : "What are the important points of JavaScript?"

                      )

                    }

                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition ${darkTheme ? "border-slate-700 bg-[#2b2b2b] text-slate-300 hover:bg-slate-800 hover:border-indigo-500" : "border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:border-indigo-300"}`}

                  >

                    {noteContent

                      ? "What are the important points?"

                      : "Important points of JavaScript"}

                  </button>



                  <button

                    onClick={() =>

                      selectQuestion(

                        noteContent

                          ? "Give me an example related to this note."

                          : "Give me a simple coding example."

                      )

                    }

                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition ${darkTheme ? "border-slate-700 bg-[#2b2b2b] text-slate-300 hover:bg-slate-800 hover:border-indigo-500" : "border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:border-indigo-300"}`}

                  >

                    {noteContent

                      ? "Give me an example"

                      : "Give me a coding example"}

                  </button>

                </div>

              </div>

            </div>

          ) : (

            <div className="space-y-4">

              {messages.map((message, index) => {

                const isUser =

                  message.role === "user";



                return (

                  <div

                    key={`${message.role}-${index}`}

                    className={`flex gap-2.5 ${

                      isUser

                        ? "justify-end"

                        : "justify-start"

                    }`}

                  >

                    {!isUser && (

                      <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-600 text-white flex items-center justify-center">

                        <Bot size={16} />

                      </div>

                    )}



                    <div
                      onClick={() => isUser && setActiveMessageMenu((current) => current === index ? null : index)}
                      title={isUser ? "Click to copy or delete this question" : undefined}
                      className={`max-w-[92%] sm:max-w-[86%] px-4 py-3 rounded-2xl text-[15px] leading-7 break-words ${
                        isUser
                          ? (darkTheme ? "bg-indigo-600 text-white rounded-br-md cursor-pointer" : "bg-[#e8e8e8] text-[#202123] rounded-br-md cursor-pointer")
                          : (darkTheme ? "bg-[#262626] text-slate-100 border border-slate-700 shadow-sm rounded-bl-md" : "bg-white text-slate-700 border border-slate-200 shadow-sm rounded-bl-md")
                      }`}
                    >
                      {isUser ? <div className="whitespace-pre-wrap">{message.content}</div> : renderMarkdown(message.content, darkTheme)}
                      {message.imageData && <img src={message.imageData} alt={message.imageName || "Uploaded attachment"} className="mt-2 max-h-48 rounded-xl object-contain" />}
                      {isUser && activeMessageMenu === index && (
                        <div className={`mt-3 flex gap-2 border-t pt-2 ${darkTheme ? "border-white/20" : "border-black/10"}`} onClick={(event) => event.stopPropagation()}>
                          <button type="button" onClick={() => copyQuestion(message.content)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${darkTheme ? "bg-slate-800 text-slate-100 hover:bg-slate-700" : "bg-white text-slate-700 hover:bg-slate-100"}`}><Copy size={13} /> Copy question</button>
                          <button type="button" onClick={() => setPendingDeleteIndex(index)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${darkTheme ? "bg-rose-950 text-rose-200 hover:bg-rose-900" : "bg-rose-50 text-rose-700 hover:bg-rose-100"}`}><Trash2 size={13} /> Delete question</button>
                        </div>
                      )}
                    </div>



                    {isUser && (

                      <div className="w-8 h-8 flex-shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center">

                        <User size={16} />

                      </div>

                    )}

                  </div>

                );

              })}



              {loading && (

                <div className="flex gap-2.5">

                  <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-600 text-white flex items-center justify-center">

                    <Bot size={16} />

                  </div>



                  <div className={`px-3.5 py-2.5 rounded-2xl rounded-bl-md border shadow-sm flex items-center gap-2 text-sm ${darkTheme ? "bg-[#262626] border-slate-700 text-slate-400" : "bg-white border-slate-200 text-slate-500"}`}>

                    <Loader2

                      size={16}

                      className="animate-spin"

                    />

                    AI is thinking...

                  </div>

                </div>

              )}



              <div ref={chatEndRef} />

            </div>

          )}

        </div>



        {/* =========================

            INPUT

        ========================= */}

        <div className={`flex-shrink-0 border-t p-3 ${darkTheme ? "border-slate-700 bg-[#171717]" : "border-slate-200 bg-white"}`}>

          {imageData && <div className={`mb-2 flex items-center gap-2 rounded-xl p-2 text-xs ${darkTheme ? "bg-indigo-950 text-indigo-200" : "bg-indigo-50 text-indigo-700"}`}><img src={imageData} alt="Selected attachment" className="h-10 w-10 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate">{imageName}</span><button onClick={() => { setImageData(""); setImageName(""); }} className={`rounded-lg px-2 py-1 ${darkTheme ? "hover:bg-slate-800" : "hover:bg-indigo-100"}`}>Remove</button></div>}

          <div className="flex items-end gap-2">

            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />&#x20;

            <button onClick={() => imageInputRef.current?.click()} title="Attach image" aria-label="Attach image" className={`h-11 w-11 flex-shrink-0 rounded-xl border transition ${darkTheme ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}><ImagePlus size={19} className="mx-auto" /></button>

            <button

              type="button"

              onClick={toggleVoiceInput}

              title={isListening ? "Stop voice input" : "Speak your message"}

              aria-label={isListening ? "Stop voice input" : "Start voice input"}

              className={`h-11 w-11 flex-shrink-0 rounded-xl border transition flex items-center justify-center ${isListening ? "border-red-300 bg-red-50 text-red-600 ring-2 ring-red-100 animate-pulse" : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}

            >

              {isListening ? <MicOff size={19} /> : <Mic size={19} />}

            </button>

            <textarea

              value={question}

              onChange={(e) =>

                setQuestion(e.target.value)

              }

              onKeyDown={handleKeyDown}

              disabled={loading}

              rows={2}

              placeholder={

                noteContent

                  ? "Ask something about your note..."

                  : "Ask anything..."

              }

              className={`flex-1 min-w-0 resize-none border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60 ${darkTheme ? "border-slate-700 bg-[#262626] text-slate-100 placeholder:text-slate-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100"}`}

            />



            <button

              onClick={handleAsk}

              disabled={

                loading || (!question.trim() && !imageData)

              }

              className="w-11 h-11 flex-shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"

              title="Send"

            >

              {loading ? (

                <Loader2

                  size={19}

                  className="animate-spin"

                />

              ) : (

                <Send size={19} />

              )}

            </button>

          </div>



          <p className="text-[11px] text-slate-400 mt-1.5">

            {isListening ? "Listening… speak clearly, then tap the mic to stop." : savingHistory ? "Saving conversation..." : "Enter to send. Shift + Enter for a new line. Tap the mic to dictate. Images up to 1 MB."}

          </p>

        </div>

      </div>

      {pendingDeleteIndex !== null && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDeleteIndex(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-question-title" className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${darkTheme ? "border-slate-700 bg-[#202123] text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><Trash2 size={20} /></div>
              <div className="min-w-0"><h2 id="delete-question-title" className="text-base font-bold">Delete this question?</h2><p className={`mt-1 text-sm leading-5 ${darkTheme ? "text-slate-300" : "text-slate-500"}`}>This will also remove the answer connected to this question. This action cannot be undone.</p></div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDeleteIndex(null)} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${darkTheme ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Cancel</button>
              <button type="button" onClick={() => deleteQuestion(pendingDeleteIndex)} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Delete question</button>
            </div>
          </div>
        </div>
      )}

    </div>

  );

}



export default AIAssistant;
