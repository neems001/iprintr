"use client";

import React, { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { useAuth, PrintRecord } from "./context/auth-context";

export default function Home() {
  const { user, history, addPrintToHistory } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("flux");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modelPlaceholders: Record<string, string> = {
    flux: "photography, real life...",
    sd35: "abstract, anime, fine art...",
    gemini: "graphics, design, layouts...",
  };

  const handleOptimize = async () => {
    if (!prompt.trim()) return;
    setIsOptimizing(true);
    setError(null);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPrompt(data.optimizedPrompt);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Prevent default newline behavior
      handleGenerate();
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setCurrentImage(null);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCurrentImage(data.imageUrl);

      // Save to history
      const record: PrintRecord = {
        id: `print_${Date.now()}`,
        prompt,
        engine: model,
        imageUrl: data.imageUrl,
        createdAt: new Date().toISOString(),
      };
      addPrintToHistory(record);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className={`container ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.logo}>iprintr</div>
        {user ? (
          <Link href="/login" className={styles.authBtn}>
            {user.name} (Profile)
          </Link>
        ) : (
          <Link href="/login" className={styles.authBtn}>
            Login / Sign Up
          </Link>
        )}
      </header>

      <div className={styles.mainGrid}>
        {/* Hardware Console Panel */}
        <section className={styles.consolePanel}>
          <div className={styles.panelTitle}>
            <span role="img" aria-label="palette">🎨</span>
            Describe an image and watch it come to life!
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Engine Selection</label>
            <select
              className={styles.select}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isGenerating}
            >
              <option value="flux">Engine V1 (Realistic) - Flux</option>
              <option value="sd35">Engine V2 (Artistic) - SD 3.5</option>
              <option value="gemini">Engine V3 (Fast/Smart) - Gemini</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Print Parameters</label>
            <textarea
              className={styles.textarea}
              placeholder={modelPlaceholders[model]}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
            />
          </div>

          {error && <div style={{ color: "#ef4444", fontSize: "0.85rem" }}>{error}</div>}

          <div className={styles.actions}>
            <button
              className={styles.optimizeBtn}
              onClick={handleOptimize}
              disabled={isGenerating || isOptimizing || !prompt.trim()}
              title="Enhance prompt using Gemini 2.5 Flash"
            >
              {isOptimizing ? "Optimizing..." : "✨ Optimize"}
            </button>
            <button
              className={styles.generateBtn}
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? "Processing..." : "Generate"}
            </button>
          </div>
        </section>

        {/* Printer Output Area */}
        <section className={styles.canvasWrapper}>
          <div className={styles.printSlot}></div>
          <div className={styles.imageContainer}>
            {isGenerating && <div className={styles.scannerLine}></div>}

            {currentImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentImage} alt="Generated print" className={styles.printedImage} />
            ) : (
              <div className={styles.emptyState}>
                {isGenerating ? "Receiving transmission..." : "Awaiting input sequence."}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* History Rack */}
      {history.length > 0 && (
        <section className={styles.historyRack}>
          <h2 className={styles.historyTitle}>Print History</h2>
          <div className={styles.historyGrid}>
            {history.map((item) => (
              <div key={item.id} className={styles.historyItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.prompt} className={styles.historyImg} />
                <div className={styles.historyInfo}>
                  <strong>{item.engine.toUpperCase()}</strong>: {item.prompt}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
