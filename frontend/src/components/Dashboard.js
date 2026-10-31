import React, { useEffect, useRef, useState } from "react";

function Dashboard({ onUploadComplete }) {
  const [notes, setNotes] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [outputMode, setOutputMode] = useState("text");
  const [selectedFile, setSelectedFile] = useState(null);
  const [summary, setSummary] = useState("");
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState("");
  const [ragIndexingWarning, setRagIndexingWarning] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && cameraStream) videoRef.current.srcObject = cameraStream;
    return () => cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  const handleFile = async (file, input) => {
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    const isImage = file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(extension);
    if (!isImage && !["txt", "md", "csv", "pdf"].includes(extension)) {
      setSelectedFile(null);
      setNotes("");
      setError("Choose a text, PDF, or image file.");
      if (input) input.value = "";
      return;
    }

    const maxSize = isImage ? 15 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setSelectedFile(null);
      setNotes("");
      setError(isImage ? "Images must be 15 MB or smaller." : "The file must be 50 MB or smaller.");
      if (input) input.value = "";
      return;
    }

    setError("");
    setRagIndexingWarning("");
    setSummary("");
    setGeneratedImage(null);
    setCameraStream(null);

    if (isImage || extension === "pdf" || file.type === "application/pdf") {
      setSelectedFile(file);
      setNotes("");
      return;
    }

    try {
      const contents = await file.text();
      if (!contents.trim()) throw new Error("This file is empty.");
      if (contents.length > 500_000) {
        throw new Error("This file has too much text. Use a file with 500,000 characters or fewer.");
      }
      setSelectedFile(file);
      setNotes(contents);
    } catch (fileError) {
      setSelectedFile(null);
      setNotes("");
      setError(fileError.message || "This file could not be read. Try another text file.");
      if (input) input.value = "";
    }
  };

  const handleFileChange = async (event) => {
    await handleFile(event.target.files?.[0], event.target);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is unavailable. Use a supported browser over HTTPS or localhost.");
      return;
    }

    try {
      setError("");
      setCameraStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }));
    } catch (cameraError) {
      setError(cameraError.name === "NotAllowedError" ? "Allow camera access in your browser, then try again." : "The camera could not be opened.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("The camera image could not be captured.");
        return;
      }
      const photo = new File([blob], `camera-notes-${Date.now()}.jpg`, { type: "image/jpeg" });
      setSelectedFile(photo);
      setNotes("");
      setSummary("");
      setGeneratedImage(null);
      setCameraStream(null);
      setError("");
    }, "image/jpeg", 0.88);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) return;

    const isPdf = selectedFile.name.toLowerCase().endsWith(".pdf") || selectedFile.type === "application/pdf";
    const isImage = selectedFile.type.startsWith("image/");
    if (!isPdf && !isImage && !notes) return;

    setIsLoading(true);
    setError("");
    setRagIndexingWarning("");
    setSummary("");
    setGeneratedImage(null);

    try {
      let response;
      const prompt = customPrompt.trim();

      if (outputMode === "image" && isPdf) {
        response = await fetch("http://127.0.0.1:5000/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/pdf", "X-Image-Prompt": prompt, "X-Source-Name": encodeURIComponent(selectedFile.name) },
          body: selectedFile,
        });
      } else if (isPdf) {
        response = await fetch("http://127.0.0.1:5000/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/pdf", "X-Summary-Prompt": prompt, "X-Source-Name": encodeURIComponent(selectedFile.name) },
          body: selectedFile,
        });
      } else if (isImage) {
        const imageDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("The image could not be read."));
          reader.readAsDataURL(selectedFile);
        });
        const imagePayload = {
          mimeType: selectedFile.type || "image/jpeg",
          data: imageDataUrl.split(",")[1],
          prompt,
          sourceName: selectedFile.name,
        };
        response = await fetch(`http://127.0.0.1:5000/api/${outputMode === "image" ? "generate-image" : "summarize-image"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(imagePayload),
        });
      } else {
        response = await fetch(`http://127.0.0.1:5000/api/${outputMode === "image" ? "generate-image" : "summarize"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: notes, prompt, sourceName: selectedFile.name }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "The summary request failed.");
      }

      if (outputMode === "image") {
        const image = {
          src: `data:${data.mimeType};base64,${data.imageData}`,
          mimeType: data.mimeType,
          caption: data.caption || "Generated from your instructions and uploaded material.",
        };
        setGeneratedImage(image);
        onUploadComplete?.({ fileName: selectedFile.name, summary: image.caption, noteId: data.noteId });
      } else {
        const generatedSummary = data.summary || "No result was returned.";
        setSummary(generatedSummary);
        onUploadComplete?.({ fileName: selectedFile.name, summary: generatedSummary, noteId: data.noteId });
      }
      if (data.ragIndexed === false) {
        setRagIndexingWarning("Your result was saved, but RAG indexing failed. This file may not appear in note-based assistant answers.");
      }
    } catch (requestError) {
      setError(requestError.message || "Could not generate a summary. Check that the backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="dashboard-card">
      <h2 className="dashboard-title">Upload your notes</h2>
      <form onSubmit={handleSubmit}>
        <span className="file-label">Add a file or capture a page</span>
        <input
          className="file-input-hidden"
          id="notes-file"
          type="file"
          accept=".txt,.md,.csv,.pdf,.png,.jpg,.jpeg,.webp,text/plain,text/markdown,text/csv,application/pdf,image/png,image/jpeg,image/webp"
          capture="environment"
          onChange={handleFileChange}
        />
        <div className="upload-source-actions">
          <label className="source-button" htmlFor="notes-file">
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2" /></svg>
            <span>Choose file</span>
          </label>
          <button className="source-button secondary" type="button" onClick={openCamera}>
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 5h-4l-2 2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2-2Z" /><circle cx="12" cy="13" r="3" /></svg>
            <span>Use camera</span>
          </button>
        </div>
        {cameraStream && (
          <div className="camera-preview">
            <video ref={videoRef} autoPlay playsInline muted aria-label="Camera preview" />
            <div className="camera-actions">
              <button type="button" className="generate-button" onClick={capturePhoto}>Capture page</button>
              <button type="button" className="camera-cancel" onClick={() => setCameraStream(null)}>Close camera</button>
            </div>
          </div>
        )}
        <p className="upload-help">
          Text, PDF, or image files. Camera capture works on localhost or HTTPS.
        </p>
        <div className="summary-prompt-field">
          <label htmlFor="summary-instructions">
            {outputMode === "image" ? "Image instructions" : "What should I do with this file?"} <span>OPTIONAL</span>
          </label>
          <textarea
            id="summary-instructions"
            value={customPrompt}
            onChange={(event) => {
              setCustomPrompt(event.target.value);
              setSummary("");
            }}
            maxLength={1000}
            rows={3}
            placeholder={outputMode === "image"
              ? "e.g. Illustrate the water cycle as a clear, labeled classroom diagram."
              : "e.g. Make a 5-question quiz or explain the key terms simply."}
          />
          <span className="prompt-field-hint">{outputMode === "image"
            ? "The image will use your file as visual context."
            : "Leave blank for a standard summary, or describe the exact task."}</span>
        </div>
        <div className="output-mode-picker" role="group" aria-label="Choose output type">
          <button
            className={outputMode === "text" ? "is-active" : ""}
            type="button"
            aria-pressed={outputMode === "text"}
            onClick={() => { setOutputMode("text"); setSummary(""); setGeneratedImage(null); }}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M4 3.5h8l4 4v9H4v-13Z" /><path d="M12 3.5v4h4M7 11h6M7 13.5h6" /></svg>
            Text result
          </button>
          <button
            className={outputMode === "image" ? "is-active" : ""}
            type="button"
            aria-pressed={outputMode === "image"}
            onClick={() => { setOutputMode("image"); setSummary(""); setGeneratedImage(null); }}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" /><circle cx="7" cy="7" r="1.4" /><path d="m4 15 4-4 2.5 2.5 2-2L16 15" /></svg>
            Generate image
          </button>
        </div>
        {selectedFile && <p className="selected-file">Selected: {selectedFile.name}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {ragIndexingWarning && <p className="rag-index-warning" role="status">{ragIndexingWarning}</p>}
        <button
          className="generate-button"
          type="submit"
          disabled={isLoading || !selectedFile}
        >
          {isLoading
            ? (outputMode === "image" ? "Creating image..." : "Working on your prompt...")
            : (outputMode === "image" ? "Generate image" : (customPrompt.trim() ? "Run instructions" : "Generate summary"))}
        </button>
      </form>
      {summary && (
        <section className="summary-panel" aria-live="polite">
          <h3>{customPrompt.trim() ? "Your result" : "Summary"}</h3>
          <p>{summary}</p>
        </section>
      )}
      {generatedImage && (
        <section className="generated-image-panel" aria-live="polite">
          <div className="generated-image-heading">
            <div><span className="section-kicker">GENERATED VISUAL</span><h3>{selectedFile?.name || "Study visual"}</h3></div>
            <a
              className="image-download-button"
              href={generatedImage.src}
              download={`studymate-visual.${generatedImage.mimeType === "image/jpeg" ? "jpg" : "png"}`}
              aria-label="Download generated image"
              title="Download image"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 13v3h12v-3" /></svg>
            </a>
          </div>
          <img src={generatedImage.src} alt={generatedImage.caption} />
          <p>{generatedImage.caption}</p>
        </section>
      )}
    </section>
  );
}

export default Dashboard;
