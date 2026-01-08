"use client";

import { Loader2, Save, Globe } from "lucide-react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const GLOBAL_SEO_ID = "global"; // Fixed ID for the single global config

// Simple custom dialog component (no external deps)
function Dialog({
  open,
  title,
  message,
  variant = "default",
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  variant?: "default" | "destructive";
  onClose: () => void;
}) {
  if (!open) return null;

  const isError = variant === "destructive";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isError ? "bg-red-100" : "bg-green-100"
            }`}
          >
            {isError ? (
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className={`px-5 py-2.5 rounded-lg font-medium transition ${
              isError
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Site2SEOManagementPage() {
  const auth = getAuth();

  const [user, setUser] = useState<User | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogVariant, setDialogVariant] = useState<"default" | "destructive">("default");

  const showDialog = (title: string, message: string, variant: "default" | "destructive" = "default") => {
    setDialogTitle(title);
    setDialogMessage(message);
    setDialogVariant(variant);
    setDialogOpen(true);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsChecking(false);
    });
    return unsubscribe;
  }, []);

  const fetchGlobalSEO = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "seoConfigs", GLOBAL_SEO_ID);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setKeywords(docSnap.data().keywords || "");
      } else {
        setKeywords("");
      }
    } catch (err: any) {
      showDialog("Load Error", err?.message || "Failed to load SEO settings", "destructive");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isChecking) {
      fetchGlobalSEO();
    }
  }, [isChecking]);

  const handleSave = async () => {
    const trimmedKeywords = keywords.trim();
    if (!trimmedKeywords) {
      showDialog("Validation Error", "Keywords cannot be empty", "destructive");
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "seoConfigs", GLOBAL_SEO_ID),
        {
          keywords: trimmedKeywords,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      await fetchGlobalSEO();

      showDialog("Success", "SEO keywords saved successfully", "default");
    } catch (err: any) {
      console.error("Save error details:", err);
      showDialog("Save Failed", err?.message || "Failed to save keywords – check console", "destructive");
    } finally {
      setSaving(false);
    }
  };

  if (isChecking)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );

  return (
    <>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Globe className="h-8 w-8 text-blue-600" />
              Site 2 – Global SEO Keywords
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              Manage site-wide meta keywords for the second site
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg shadow transition"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                Save Keywords
              </>
            )}
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white shadow-sm rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Site-wide Keywords</h2>
            <p className="text-sm text-gray-500 mt-2">
              Separate keywords with commas.
            </p>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
                    Keywords
                  </label>
                  <textarea
                    id="keywords"
                    placeholder="e.g. payment gateway, online payments, nigeria fintech, instant transfer, bill payment..."
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Dialog */}
      <Dialog
        open={dialogOpen}
        title={dialogTitle}
        message={dialogMessage}
        variant={dialogVariant}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}