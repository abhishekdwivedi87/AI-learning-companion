import React, { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import AssistantChat from "./components/AssistantChat";

const HISTORY_STORAGE_KEY = "studymate.history.v1";

function loadHistory() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function documentTitle(fileName) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function findStoredGmail() {
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !/(auth|user|profile|session|account|google|firebase|email)/i.test(key)) continue;
      const value = key ? window.localStorage.getItem(key) : null;
      if (!value) continue;

      const match = value.match(/[a-z0-9._%+-]+@gmail\.com/i);
      if (match) return { email: match[0], storageKey: key };
    }
  } catch {
    return null;
  }

  return null;
}

function getFirstName(email) {
  const firstPart = email?.split("@")[0]?.split(/[._+-]/)[0];
  return firstPart ? firstPart.charAt(0).toUpperCase() + firstPart.slice(1) : "there";
}

function Icon({ name, size = 18 }) {
  const paths = {
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1 2.5 2.5 1-2.5 1L19 21l-1-2.5-2.5-1 2.5-1L19 14Z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2" /></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h6.5A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5H12" /></>,
    collapse: <><path d="m14 18-6-6 6-6" /></>,
    expand: <><path d="m10 18 6-6-6-6" /></>,
  };

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function App() {
  const [storedIdentity, setStoredIdentity] = useState(findStoredGmail);
  const [historyItems, setHistoryItems] = useState(loadHistory);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [workspaceSession, setWorkspaceSession] = useState(0);
  const [activeChat, setActiveChat] = useState(() => ({
    id: makeId(),
    type: "chat",
    title: "New conversation",
    messages: [],
  }));
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const firstName = getFirstName(storedIdentity?.email);
  const selectedHistory = historyItems.find((item) => item.id === selectedHistoryId);
  const activeNoteTitle = historyItems.find(
    (item) => item.type === "document" && item.noteId === activeNoteId,
  )?.title || null;
  const orderedHistory = [...historyItems].sort((first, second) => second.updatedAt - first.updatedAt);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyItems));
    } catch {
      console.warn("Could not save workspace history.");
    }
  }, [historyItems]);

  const persistHistory = (nextItems) => {
    setHistoryItems(nextItems);
  };

  const handleNewChat = () => {
    setWorkspaceSession((session) => session + 1);
    setActiveChat({
      id: makeId(),
      type: "chat",
      title: "New conversation",
      messages: [],
      noteId: activeNoteId,
    });
    setSelectedHistoryId(null);
  };

  const handleConversationChange = (messages, noteId) => {
    const firstUserMessage = messages.find((message) => message.role === "user")?.content || "";
    const title = firstUserMessage.length > 38 ? `${firstUserMessage.slice(0, 38).trim()}...` : firstUserMessage || "New conversation";
    const associatedNoteId = noteId || activeNoteId;
    const updatedChat = { ...activeChat, title, messages, noteId: associatedNoteId, updatedAt: Date.now() };
    setActiveChat(updatedChat);
    setActiveNoteId(associatedNoteId);
    setSelectedHistoryId(updatedChat.id);
    persistHistory([updatedChat, ...historyItems.filter((item) => item.id !== updatedChat.id)]);
  };

  const handleUploadComplete = ({ fileName, summary, noteId }) => {
    const now = Date.now();
    const document = {
      id: makeId(),
      type: "document",
      title: documentTitle(fileName),
      fileName,
      summary,
      noteId,
      updatedAt: now,
    };
    persistHistory([document, ...historyItems]);
    setActiveNoteId(noteId || null);
    setSelectedHistoryId(document.id);
  };

  const handleHistorySelect = (item) => {
    setSelectedHistoryId(item.id);
    if (item.type === "chat") {
      setActiveChat(item);
      setActiveNoteId(item.noteId || null);
    } else {
      setActiveNoteId(item.noteId || null);
    }
  };

  const handleSignOut = () => {
    if (storedIdentity?.storageKey) {
      try {
        window.localStorage.removeItem(storedIdentity.storageKey);
      } catch {
        console.warn("Could not clear the saved account from browser storage.");
      }
    }
    setStoredIdentity(null);
  };

  return (
    <div className={`app-shell${dashboardOpen ? "" : " sidebar-collapsed"}`}>
      <aside className="sidebar">
        <div className="sidebar-topline">
          <a className="brand" href="#workspace" aria-label="AI Learning Companion home">
            <span className="brand-mark"><Icon name="spark" size={20} /></span>
            <span className="brand-name">Study<span className="brand-accent">mate</span></span>
          </a>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setDashboardOpen((open) => !open)}
            aria-label={dashboardOpen ? "Close dashboard" : "Open dashboard"}
            title={dashboardOpen ? "Close dashboard" : "Open dashboard"}
          >
            <Icon name={dashboardOpen ? "collapse" : "expand"} />
          </button>
        </div>

        <section className="profile-block" aria-label="Profile">
          <div className="profile-avatar">{firstName.charAt(0).toUpperCase()}</div>
          <div className="profile-details">
            <strong>{storedIdentity ? firstName : "Guest learner"}</strong>
            <span>{storedIdentity?.email || "Personal workspace"}</span>
          </div>
          <span className="profile-status" aria-label="Active" />
        </section>

        <div className="sidebar-workspace">
          <button className="new-chat-button" type="button" onClick={handleNewChat} title="New chat">
            <Icon name="plus" />
            <span>New chat</span>
          </button>

          <div className="history-heading">
            <span>Workspace</span>
            <span className="history-count">{historyItems.length}</span>
          </div>
          <div className="history-list">
            {orderedHistory.length === 0 && <p className="history-empty">Your conversations and notes will show up here.</p>}
            {orderedHistory.map((item) => (
              <button
                className={`history-button${selectedHistoryId === item.id ? " is-selected" : ""}`}
                key={item.id}
                type="button"
                onClick={() => handleHistorySelect(item)}
                title={item.title}
              >
                <Icon name="history" />
                <span className="history-item-title">{item.title}</span>
                <span className="history-item-type">{item.type === "document" ? "NOTE" : "CHAT"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-plan"><span className="plan-dot" /> Learning space</div>
          <button className="signout-button" type="button" onClick={handleSignOut}>
            <Icon name="logout" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main-content" id="workspace">
        <div className="main-topline">
          <span className="breadcrumb">Workspace <span>/</span> My notes</span>
          <span className="secure-label"><span /> Ready to study</span>
        </div>
        <div className="content-inner">
          <div className="welcome-copy">
            <span className="eyebrow">YOUR LEARNING DESK</span>
            <h1>Make room for<br /><span>what you'll learn.</span></h1>
            <p>Bring your notes in. We’ll help you turn them into clear ideas and useful summaries.</p>
          </div>
          <div className="upload-intro">
            <div>
              <span className="section-kicker">START WITH YOUR MATERIAL</span>
              <h2>Upload your notes</h2>
            </div>
            <span className="upload-icon"><Icon name="upload" size={19} /></span>
          </div>
          <Dashboard key={workspaceSession} onUploadComplete={handleUploadComplete} />
          {selectedHistory?.type === "document" && (
            <section className="saved-document" aria-live="polite">
              <div className="saved-document-heading">
                <div><span className="section-kicker">SAVED NOTE</span><h2>{selectedHistory.title}</h2></div>
                <span className="document-type">{selectedHistory.fileName.split(".").pop()?.toUpperCase()} FILE</span>
              </div>
              <p className="saved-document-filename">{selectedHistory.fileName}</p>
              <h3>Summary</h3>
              <p className="saved-document-summary">{selectedHistory.summary}</p>
            </section>
          )}
          <div className="content-footnote"><span /> Document names and summaries are saved in this browser.</div>
        </div>
      </main>

      <aside className="assistant-panel">
        <div className="assistant-heading">
          <div className="assistant-heading-icon"><Icon name="spark" size={18} /></div>
          <div><h2>AI assistant</h2><span><i /> Online and ready</span></div>
          <button className="more-button" type="button" aria-label="Assistant options">...</button>
        </div>
        <AssistantChat
          key={activeChat.id}
          userName={firstName}
          initialMessages={activeChat.messages || []}
          selectedNoteId={activeNoteId}
          selectedNoteTitle={activeNoteTitle}
          onConversationChange={handleConversationChange}
        />
      </aside>
    </div>
  );
}

export default App;
