"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import { useAuth } from "../context/auth-context";

export default function Login() {
  const { user, login, logout } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await login(email, name);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to authenticate");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (user) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <h1 className={styles.title}>Welcome, {user.name}</h1>
          <p className={styles.subtitle}>{user.email}</p>

          <button className={styles.logoutBtn} onClick={handleLogout}>
            Log Out
          </button>

          <Link href="/" className={styles.backLink}>
            Return to Console
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginContainer}>
      <form className={styles.loginCard} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Sign Up / Login</h1>
        <p className={styles.subtitle}>Enter credentials to save your prints in Prisma Postgres.</p>

        {error && <div style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{error}</div>}

        <div className={styles.inputGroup}>
          <label className={styles.label}>Name</label>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="enter your name"
            disabled={isSubmitting}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="enter your email"
            disabled={isSubmitting}
          />
        </div>

        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
          {isSubmitting ? "Authenticating..." : "Authenticate"}
        </button>

        <Link href="/" className={styles.backLink}>
          Back to Generator (Guest Mode)
        </Link>
      </form>
    </div>
  );
}
