import React, { useState } from "react";

const API_URL = "http://127.0.0.1:5000";

function ConceptMap({ map }) {
  return (
    <section className="concept-map" aria-label={`Concept map: ${map.title}`}>
      <div className="concept-map-heading">
        <span>STUDY MAP</span>
        <h3>{map.title}</h3>
      </div>
      <div className="concept-map-center">
        <span>CORE IDEA</span>
        <strong>{map.centralConcept}</strong>
        {map.centralDescription && <p>{map.centralDescription}</p>}
      </div>
      <div className="concept-map-branches">
        {map.branches.map((branch, index) => (
          <article className="concept-branch" key={`${branch.concept}-${index}`}>
            {branch.relationship && <span className="concept-relationship">{branch.relationship}</span>}
            <div className="concept-node">
              <strong>{branch.concept}</strong>
              {branch.description && <p>{branch.description}</p>}
            </div>
            {branch.children?.length > 0 && (
              <ul className="concept-children">
                {branch.children.map((child, childIndex) => (
                  <li key={`${child.concept}-${childIndex}`}>
                    <strong>{child.concept}</strong>
                    {child.relationship && <span>{child.relationship}</span>}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function AssistantChat({
  userName = "there",
  initialMessages = [],
  selectedNoteId = null,
  selectedNoteTitle = null,
  onConversationChange,
}) {
  const [chatHistory, setChatHistory] = useState(initialMessages);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [useRag, setUseRag] = useState(false);

  const sendMessage = async (event) => {
    event?.preventDefault();
    const prompt = message.trim();
    if (!prompt || loading) return;

    const newHistory = [...chatHistory, { role: "user", content: prompt }];
    setChatHistory(newHistory);
    setMessage("");
    setLoading(true);

    try {
      const isConceptMapRequest = /\b(concept|mind)\s*[- ]?map\b/i.test(prompt);
      const response = await fetch(
        `${API_URL}${isConceptMapRequest ? "/api/concept-map" : useRag ? "/api/rag-assistant" : "/api/assistant"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isConceptMapRequest
            ? { noteId: selectedNoteId }
            : useRag
              ? { message: prompt, history: newHistory }
              : { message: prompt, history: newHistory, noteId: selectedNoteId, useNotes: false }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The assistant could not complete that request.");

      const answer = isConceptMapRequest
        ? { role: "assistant", content: "Here is a concept map of your notes.", conceptMap: data.conceptMap }
        : { role: "assistant", content: data.reply || "No reply was returned.", grounded: useRag, sources: useRag ? data.sources || [] : [] };
      const nextHistory = [...newHistory, answer];
      setChatHistory(nextHistory);
      onConversationChange?.(nextHistory, selectedNoteId);
    } catch (error) {
      const nextHistory = [...newHistory, { role: "assistant", content: error.message || "The assistant could not respond." }];
      setChatHistory(nextHistory);
      onConversationChange?.(nextHistory, selectedNoteId);
    } finally {
      setLoading(false);
    }
  };

  const askSuggestion = (prompt) => {
    setMessage(prompt);
  };

  return (
    <div className="assistant-chat">
      <div className="chat-context-bar">
        <label className={`rag-mode-toggle${useRag ? " is-active" : ""}`}>
          <input type="checkbox" checked={useRag} onChange={(event) => setUseRag(event.target.checked)} />
          <span className="rag-mode-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2" /><circle cx="4" cy="5" r="1.5" /><circle cx="16" cy="5" r="1.5" /><circle cx="4" cy="15" r="1.5" /><circle cx="16" cy="15" r="1.5" /><path d="m5.3 6 3.2 2.8m3.1 0L14.7 6m-9.4 8 3.2-2.8m3.1 0 3.1 2.8" /></svg>
          </span>
          <span className="rag-mode-copy"><strong>RAG</strong><small>{useRag ? "Semantic search on" : "Semantic search off"}</small></span>
          <span className="rag-mode-switch" aria-hidden="true"><span /></span>
        </label>
        <span className="chat-context-source" title={useRag ? "Searches across your saved notes" : selectedNoteTitle || "Most recently uploaded notes"}>
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M4 2.5h5l3 3v8H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" /><path d="M9 2.5v3h3M5.5 8h5M5.5 10.5h5" /></svg>
          <span>{useRag ? "All saved notes" : selectedNoteTitle || "Latest uploaded notes"}</span>
        </span>
      </div>

      <div className="chat-messages" aria-live="polite">
        {chatHistory.length === 0 ? (
          <div className="chat-welcome">
            <div className="welcome-spark" aria-hidden="true">✳</div>
            <span className="chat-overline">YOUR STUDY PARTNER</span>
            <h3>Hi {userName},<br />let’s make it click.</h3>
            <p>Ask a question about your notes or turn the key ideas into a visual map.</p>
            <div className="suggestion-label">TRY ASKING</div>
            <button className="suggestion-chip" type="button" onClick={() => askSuggestion("Make a concept map of my notes")}>
              <span>Make a concept map of my notes</span><span aria-hidden="true">↗</span>
            </button>
            <button className="suggestion-chip" type="button" onClick={() => askSuggestion("Explain the key ideas in my notes")}>
              <span>Explain the key ideas in my notes</span><span aria-hidden="true">↗</span>
            </button>
          </div>
        ) : chatHistory.map((item, index) => (
          <article className={`chat-message ${item.role === "user" ? "user" : "assistant"}`} key={`${item.role}-${index}`}>
            <div className="message-meta">
              <span className="message-avatar">{item.role === "user" ? userName.charAt(0).toUpperCase() : "✳"}</span>
              <span className="message-author">{item.role === "user" ? "You" : "StudyMate"}</span>
              {item.grounded && item.role === "assistant" && <span className="grounded-tag">RAG · notes</span>}
            </div>
            {item.conceptMap ? <ConceptMap map={item.conceptMap} /> : <p>{item.content}</p>}
            {item.sources?.length > 0 && (
              <div className="rag-citations" aria-label="Retrieved sources">
                <strong>Sources</strong>
                {item.sources.map((source) => (
                  <div className="rag-citation" key={`${source.id}-${source.reference}`}>
                    <span className="rag-citation-number">[{source.reference}]</span>
                    <div>
                      <span className="rag-citation-title">
                        {source.title}{source.chunkIndex ? ` · passage ${source.chunkIndex}` : ""}
                      </span>
                      <p>{source.snippet}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
        {loading && <div className="typing-indicator"><span /><span /><span />{/\b(concept|mind)\s*[- ]?map\b/i.test(message) ? "Building your map" : useRag ? "Searching your notes" : "Thinking"}</div>}
      </div>

      <form className="chat-composer" onSubmit={sendMessage}>
        <input
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={useRag ? "Ask about your notes..." : "Ask me anything..."}
          aria-label="Message the assistant"
        />
        <button type="submit" disabled={!message.trim() || loading} aria-label="Send message" title="Send message">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M10 15V4m0 0L5.5 8.5M10 4l4.5 4.5" /></svg>
        </button>
      </form>
      <p className="assistant-disclaimer">{useRag ? "Answers use relevant passages retrieved from your saved notes." : "RAG is off. Turn it on to search your saved notes."}</p>
    </div>
  );
}
