"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  limit,
  query,
} from "firebase/firestore";

const COLLECTIONS = [
  "users",
  "transactions",
  "loginLogs",
  "blockedLogins",
  "activityLogs",
  "referrals",
  "businesses",
  "admins",
  "settings",
  "seoConfigs",
  "company",
  "notifications",
];

function serializeDoc(data: Record<string, unknown>): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map((v) => serializeDoc(v as Record<string, unknown>));
  // Firestore Timestamp
  if (typeof (data as any).toDate === "function") {
    return (data as any).toDate().toISOString();
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = serializeDoc(v as Record<string, unknown>);
  }
  return out;
}

export default function InspectPage() {
  const [results, setResults] = useState<Record<string, unknown[]>>({});
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<"waiting" | "ready" | "none">("waiting");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthStatus(user ? "ready" : "none");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authStatus !== "ready") return;

    async function fetchAll() {
      const out: Record<string, unknown[]> = {};
      await Promise.all(
        COLLECTIONS.map(async (col) => {
          try {
            const snap = await getDocs(query(collection(db, col), limit(3)));
            out[col] = snap.docs
              .filter((d) => d.data().mock !== true)
              .map((d) =>
                serializeDoc({ _id: d.id, ...d.data() } as Record<string, unknown>)
              );
          } catch {
            out[col] = ["[error fetching collection]"];
          }
        })
      );
      setResults(out);
      setLoading(false);
    }
    fetchAll();
  }, [authStatus]);

  const json = JSON.stringify(results, null, 2);

  function handleCopy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ fontFamily: "monospace", padding: "24px", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#f8fafc" }}>
          Firestore Data Inspector
        </h1>
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
          (real data only · up to 3 docs per collection)
        </span>
        <button
          onClick={handleCopy}
          disabled={loading}
          style={{
            marginLeft: "auto",
            padding: "6px 18px",
            background: copied ? "#22c55e" : "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 600,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {copied ? "Copied!" : "Copy All JSON"}
        </button>
      </div>

      {authStatus === "waiting" ? (
        <p style={{ color: "#94a3b8" }}>Waiting for auth...</p>
      ) : authStatus === "none" ? (
        <p style={{ color: "#f87171" }}>
          Not logged in. Please{" "}
          <a href="/login" style={{ color: "#818cf8", textDecoration: "underline" }}>
            log in first
          </a>
          , then come back to <code>/inspect</code>.
        </p>
      ) : loading ? (
        <p style={{ color: "#94a3b8" }}>Fetching collections...</p>
      ) : (
        <pre
          style={{
            background: "#1e293b",
            borderRadius: "8px",
            padding: "20px",
            overflowX: "auto",
            fontSize: "12px",
            lineHeight: "1.6",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {json}
        </pre>
      )}
    </div>
  );
}
