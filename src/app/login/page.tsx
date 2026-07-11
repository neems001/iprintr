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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && name) {
      login(email, name);
      router.push("/");
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
        <h1 className={styles.title}>SYSTEM_AUTH</h1>
        <p className={styles.subtitle}>Enter credentials to access premium print features.</p>
        
        <div className={styles.inputGroup}>
          <label className={styles.label}>Identifier (Name)</label>
          <input 
            type="text" 
            className={styles.input} 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            required 
            placeholder="e.g. Alex"
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Access Code (Email)</label>
          <input 
            type="email" 
            className={styles.input} 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            placeholder="alex@example.com"
          />
        </div>

        <button type="submit" className={styles.submitBtn}>
          Authenticate
        </button>

        <Link href="/" className={styles.backLink}>
          Back to Generator (Guest Mode)
        </Link>
      </form>
    </div>
  );
}
