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

function serializeDoc(data: Record<string, unknown>): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map((v) => serializeDoc(v as Record<string, unknown>));
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
  const [results, setResults] = useState<unknown[]>([]);
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

    async function fetchKYC() {
      try {
        // Fetch 10 real users that have qoreIdData (KYC submitted)
        const snap = await getDocs(
          query(collection(db, "users"), limit(10))
        );
        const docs = snap.docs
          .filter((d) => d.data().mock !== true)
          .map((d) => serializeDoc({ _id: d.id, ...d.data() } as Record<string, unknown>));
        setResults(docs);
      } catch (e) {
        setResults([{ error: String(e) }]);
      }
      setLoading(false);
    }
    fetchKYC();
  }, [authStatus]);

  const json = JSON.stringify(results, null, 2);

  return (
    <div style={{ padding: 24, fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 18, marginBottom: 16 }}>
        KYC Inspect — users (10 real docs)
      </h1>

      {authStatus === "waiting" && <p>Waiting for auth…</p>}
      {authStatus === "none" && <p style={{ color: "red" }}>Not authenticated. Please log in first.</p>}
      {authStatus === "ready" && loading && <p>Loading…</p>}

      {authStatus === "ready" && !loading && (
        <>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(json);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            style={{
              marginBottom: 12,
              padding: "6px 16px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {copied ? "Copied!" : "Copy JSON"}
          </button>
          <pre
            style={{
              background: "#1e1e1e",
              color: "#d4d4d4",
              padding: 16,
              borderRadius: 8,
              overflow: "auto",
              maxHeight: "80vh",
              fontSize: 12,
            }}
          >
            {json}
          </pre>
        </>
      )}
    </div>
  );
}
