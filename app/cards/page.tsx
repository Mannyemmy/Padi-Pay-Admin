"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
import { showToast } from "@/components/Toast";

type CardBrand = "Verve" | "AfriGo";
type InventoryStatus = "unassigned" | "assigned" | "active";
type TrackingStatus =
  | "pending"
  | "processing"
  | "in_transit"
  | "out_for_delivery"
  | "delivered";

interface InventoryCard {
  id: string;
  cardNumber: string;
  brand: CardBrand;
  status: InventoryStatus;
  assignedUserId?: string;
  assignedAt?: Date;
  assignedCardDocPath?: string;
  createdAt?: Date;
  updatedAt?: Date;
  tracking?: {
    status?: TrackingStatus;
    courier?: string;
    trackingNumber?: string;
    note?: string;
    etaDate?: string;
    updatedAt?: Date;
  };
}

const BRAND_OPTIONS: CardBrand[] = ["Verve", "AfriGo"];
const TRACKING_OPTIONS: TrackingStatus[] = [
  "pending",
  "processing",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

const toDate = (value: unknown): Date | undefined => {
  const maybeTimestamp = value as { toDate?: () => Date };
  if (maybeTimestamp?.toDate) return maybeTimestamp.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
};

const formatDate = (value?: Date) => {
  if (!value) return "-";
  return value.toLocaleString();
};

const maskCardNumber = (cardNumber: string) => {
  if (cardNumber.length <= 4) return cardNumber;
  return `${"*".repeat(Math.max(cardNumber.length - 4, 0))}${cardNumber.slice(-4)}`;
};

export default function CardsPage() {
  const [cards, setCards] = useState<InventoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rateLoading, setRateLoading] = useState(true);
  const [rateSaving, setRateSaving] = useState(false);
  const [usdNgnRateInput, setUsdNgnRateInput] = useState("");
  const [usdNgnRateUpdatedBy, setUsdNgnRateUpdatedBy] = useState<string | null>(null);
  const [usdNgnRateUpdatedAt, setUsdNgnRateUpdatedAt] = useState<Date | null>(null);

  const [brand, setBrand] = useState<CardBrand>("Verve");
  const [singleCardNumber, setSingleCardNumber] = useState("");
  const [bulkCardNumbers, setBulkCardNumbers] = useState("");

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("pending");
  const [trackingCourier, setTrackingCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingEtaDate, setTrackingEtaDate] = useState("");
  const [trackingNote, setTrackingNote] = useState("");

  const loadCards = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(query(collection(db, "physical_card_inventory")));
      const rows = snapshot.docs
        .map((snap) => {
          const data = snap.data() as Record<string, unknown>;
          const trackingRaw = (data.tracking ?? {}) as Record<string, unknown>;
          return {
            id: snap.id,
            cardNumber: String(data.cardNumber ?? ""),
            brand: (String(data.brand ?? "Verve") as CardBrand),
            status: (String(data.status ?? "unassigned") as InventoryStatus),
            assignedUserId: data.assignedUserId ? String(data.assignedUserId) : undefined,
            assignedCardDocPath: data.assignedCardDocPath
              ? String(data.assignedCardDocPath)
              : undefined,
            assignedAt: toDate(data.assignedAt),
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            tracking: {
              status: trackingRaw.status
                ? (String(trackingRaw.status) as TrackingStatus)
                : undefined,
              courier: trackingRaw.courier ? String(trackingRaw.courier) : undefined,
              trackingNumber: trackingRaw.trackingNumber
                ? String(trackingRaw.trackingNumber)
                : undefined,
              note: trackingRaw.note ? String(trackingRaw.note) : undefined,
              etaDate: trackingRaw.etaDate ? String(trackingRaw.etaDate) : undefined,
              updatedAt: toDate(trackingRaw.updatedAt),
            },
          } as InventoryCard;
        })
        .sort((a, b) => {
          const left = a.createdAt?.getTime() ?? 0;
          const right = b.createdAt?.getTime() ?? 0;
          return right - left;
        });
      setCards(rows);
    } catch (err) {
      console.error("Failed to load card inventory", err);
      showToast("error", "Load failed", "Could not fetch card inventory");
    } finally {
      setLoading(false);
    }
  };

  const loadUsdNgnRate = async () => {
    try {
      setRateLoading(true);
      const companyRef = doc(db, "company", "sudoAccountDetails");
      const companySnap = await getDoc(companyRef);
      const companyData = companySnap.data() as Record<string, unknown> | undefined;
      const rawRate = companyData?.usdNgnRate;
      const parsedRate =
        typeof rawRate === "number"
          ? rawRate
          : typeof rawRate === "string"
            ? Number(rawRate)
            : NaN;

      if (Number.isFinite(parsedRate) && parsedRate > 0) {
        setUsdNgnRateInput(String(parsedRate));
      }

      setUsdNgnRateUpdatedBy(
        typeof companyData?.usdNgnRateUpdatedBy === "string"
          ? companyData.usdNgnRateUpdatedBy
          : null,
      );
      const updatedAt = toDate(companyData?.usdNgnRateUpdatedAt);
      setUsdNgnRateUpdatedAt(updatedAt ?? null);
    } catch (err) {
      console.error("Failed to load USD/NGN rate", err);
      showToast("error", "Load failed", "Could not fetch USD/NGN rate");
    } finally {
      setRateLoading(false);
    }
  };

  const saveUsdNgnRate = async () => {
    const rate = Number(usdNgnRateInput.trim());
    if (!Number.isFinite(rate) || rate <= 0) {
      showToast("error", "Invalid rate", "Enter a valid USD/NGN rate greater than zero");
      return;
    }

    try {
      setRateSaving(true);
      const auth = getAuth();
      const editor = auth.currentUser?.email || auth.currentUser?.uid || "admin";
      await setDoc(
        doc(db, "company", "sudoAccountDetails"),
        {
          usdNgnRate: rate,
          usdNgnRateUpdatedBy: editor,
          usdNgnRateUpdatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      showToast("success", "Rate saved", `1 USD = NGN ${rate.toLocaleString()}`);
      await loadUsdNgnRate();
    } catch (err) {
      console.error("Failed to save USD/NGN rate", err);
      showToast("error", "Save failed", "Could not update USD/NGN rate");
    } finally {
      setRateSaving(false);
    }
  };

  useEffect(() => {
    loadCards();
    loadUsdNgnRate();
  }, []);

  const metrics = useMemo(() => {
    const total = cards.length;
    const unassigned = cards.filter((c) => c.status === "unassigned").length;
    const assigned = cards.filter((c) => c.status === "assigned").length;
    const delivered = cards.filter((c) => c.tracking?.status === "delivered").length;
    return { total, unassigned, assigned, delivered };
  }, [cards]);

  const normalizeCardNumber = (input: string) => input.replace(/\s+/g, "").trim();

  const createInventoryCards = async (event: FormEvent) => {
    event.preventDefault();
    const parsedBulk = bulkCardNumbers
      .split(/[\n,]+/)
      .map((n) => normalizeCardNumber(n))
      .filter(Boolean);
    const parsedSingle = normalizeCardNumber(singleCardNumber);

    const allValues = Array.from(
      new Set([...(parsedSingle ? [parsedSingle] : []), ...parsedBulk]),
    );

    if (!allValues.length) {
      showToast("error", "Missing card number", "Add at least one card number");
      return;
    }

    const invalid = allValues.find((v) => !/^\d{12,20}$/.test(v));
    if (invalid) {
      showToast(
        "error",
        "Invalid value",
        `Card number ${invalid} should contain 12-20 digits`,
      );
      return;
    }

    setSaving(true);
    try {
      const writes = allValues.map((cardNumber) =>
        addDoc(collection(db, "physical_card_inventory"), {
          cardNumber,
          cardNumberLast4: cardNumber.slice(-4),
          brand,
          status: "unassigned",
          tracking: {
            status: "pending",
            note: "Inventory loaded by admin",
            updatedAt: serverTimestamp(),
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
      await Promise.all(writes);
      setSingleCardNumber("");
      setBulkCardNumbers("");
      showToast("success", "Inventory added", `${allValues.length} card number(s) saved`);
      await loadCards();
    } catch (err) {
      console.error("Failed to create inventory cards", err);
      showToast("error", "Save failed", "Could not store card inventory");
    } finally {
      setSaving(false);
    }
  };

  const openTrackingEditor = (card: InventoryCard) => {
    setEditingCardId(card.id);
    setTrackingStatus(card.tracking?.status ?? "pending");
    setTrackingCourier(card.tracking?.courier ?? "");
    setTrackingNumber(card.tracking?.trackingNumber ?? "");
    setTrackingEtaDate(card.tracking?.etaDate ?? "");
    setTrackingNote(card.tracking?.note ?? "");
  };

  const closeTrackingEditor = () => {
    setEditingCardId(null);
    setTrackingStatus("pending");
    setTrackingCourier("");
    setTrackingNumber("");
    setTrackingEtaDate("");
    setTrackingNote("");
  };

  const saveTracking = async (card: InventoryCard) => {
    setSaving(true);
    try {
      const trackingPayload = {
        status: trackingStatus,
        courier: trackingCourier.trim(),
        trackingNumber: trackingNumber.trim(),
        etaDate: trackingEtaDate.trim(),
        note: trackingNote.trim(),
        updatedAt: serverTimestamp(),
      };

      const status: InventoryStatus =
        trackingStatus === "delivered"
          ? "active"
          : card.assignedUserId
            ? "assigned"
            : "unassigned";

      await updateDoc(doc(db, "physical_card_inventory", card.id), {
        tracking: trackingPayload,
        status,
        updatedAt: serverTimestamp(),
      });

      if (card.assignedCardDocPath) {
        await updateDoc(doc(db, card.assignedCardDocPath), {
          physicalCardTracking: trackingPayload,
          physicalCardDelivered: trackingStatus === "delivered",
          updatedAt: serverTimestamp(),
        });
      }

      showToast("success", "Updated", "Tracking status saved");
      closeTrackingEditor();
      await loadCards();
    } catch (err) {
      console.error("Failed to save tracking", err);
      showToast("error", "Update failed", "Could not save tracking status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Physical Card Inventory</h1>
        <p className="text-sm text-gray-600">
          Securely load card numbers, monitor assignment status, and update delivery tracking.
        </p>
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">USD/NGN Rate Settings</h2>
          <p className="text-sm text-gray-600">
            This rate is used during USD card creation and displayed to customers in app.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-gray-600">1 USD equals how many NGN?</span>
            <input
              value={usdNgnRateInput}
              onChange={(e) => setUsdNgnRateInput(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="e.g. 1600"
              disabled={rateLoading || rateSaving}
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={saveUsdNgnRate}
              disabled={rateLoading || rateSaving}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {rateSaving ? "Saving..." : "Save Rate"}
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          {rateLoading
            ? "Loading latest rate..."
            : usdNgnRateInput
              ? `Current rate: 1 USD = NGN ${Number(usdNgnRateInput).toLocaleString()}`
              : "No USD/NGN rate configured yet."}
          {(usdNgnRateUpdatedBy || usdNgnRateUpdatedAt) && (
            <p className="mt-1">
              Last updated{usdNgnRateUpdatedBy ? ` by ${usdNgnRateUpdatedBy}` : ""}
              {usdNgnRateUpdatedAt ? ` on ${usdNgnRateUpdatedAt.toLocaleString()}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-semibold text-gray-900">{metrics.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Unassigned</p>
          <p className="text-2xl font-semibold text-emerald-700">{metrics.unassigned}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Assigned</p>
          <p className="text-2xl font-semibold text-amber-700">{metrics.assigned}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Delivered</p>
          <p className="text-2xl font-semibold text-blue-700">{metrics.delivered}</p>
        </div>
      </div>

      <form onSubmit={createInventoryCards} className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Load Card Numbers</h2>
          <p className="text-sm text-gray-600">
           Physical card inventory.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Brand</span>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value as CardBrand)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {BRAND_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-gray-600">Single Card Number</span>
            <input
              value={singleCardNumber}
              onChange={(e) => setSingleCardNumber(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="5063210000000001"
            />
          </label>
        </div>

        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Bulk Entry (one per line or comma-separated)</span>
          <textarea
            value={bulkCardNumbers}
            onChange={(e) => setBulkCardNumbers(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder={"5063210000000001\n5063210000000002"}
          />
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Inventory"}
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Card Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Brand</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tracking</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Updated</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    Loading card inventory...
                  </td>
                </tr>
              )}
              {!loading && cards.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    No inventory loaded yet.
                  </td>
                </tr>
              )}
              {!loading &&
                cards.map((card) => {
                  const isEditing = editingCardId === card.id;
                  return (
                    <Fragment key={card.id}>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900" title={card.cardNumber}>
                          {maskCardNumber(card.cardNumber)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{card.brand}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{card.status}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {card.assignedUserId ? (
                            <div>
                              <p className="font-medium text-gray-900">{card.assignedUserId}</p>
                              <p className="text-xs text-gray-500">{formatDate(card.assignedAt)}</p>
                            </div>
                          ) : (
                            "Unassigned"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {card.tracking?.status || "pending"}
                          {card.tracking?.trackingNumber ? (
                            <p className="text-xs text-gray-500">{card.tracking.trackingNumber}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(card.updatedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
                            onClick={() => openTrackingEditor(card)}
                          >
                            Update Tracking
                          </button>
                        </td>
                      </tr>

                      {isEditing ? (
                        <tr>
                          <td colSpan={7} className="bg-gray-50 px-4 py-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                              <label className="text-sm">
                                <span className="mb-1 block text-gray-600">Tracking Status</span>
                                <select
                                  value={trackingStatus}
                                  onChange={(e) =>
                                    setTrackingStatus(e.target.value as TrackingStatus)
                                  }
                                  className="w-full rounded border border-gray-300 px-2 py-2"
                                >
                                  {TRACKING_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-sm">
                                <span className="mb-1 block text-gray-600">Courier</span>
                                <input
                                  value={trackingCourier}
                                  onChange={(e) => setTrackingCourier(e.target.value)}
                                  className="w-full rounded border border-gray-300 px-2 py-2"
                                  placeholder="DHL"
                                />
                              </label>
                              <label className="text-sm">
                                <span className="mb-1 block text-gray-600">Tracking Number</span>
                                <input
                                  value={trackingNumber}
                                  onChange={(e) => setTrackingNumber(e.target.value)}
                                  className="w-full rounded border border-gray-300 px-2 py-2"
                                  placeholder="AWB1234567"
                                />
                              </label>
                              <label className="text-sm">
                                <span className="mb-1 block text-gray-600">Estimated Delivery</span>
                                <input
                                  value={trackingEtaDate}
                                  onChange={(e) => setTrackingEtaDate(e.target.value)}
                                  className="w-full rounded border border-gray-300 px-2 py-2"
                                  placeholder="2026-05-07"
                                />
                              </label>
                              <label className="text-sm md:col-span-2">
                                <span className="mb-1 block text-gray-600">Note</span>
                                <input
                                  value={trackingNote}
                                  onChange={(e) => setTrackingNote(e.target.value)}
                                  className="w-full rounded border border-gray-300 px-2 py-2"
                                  placeholder="Card dispatched from Lagos hub"
                                />
                              </label>
                            </div>
                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={closeTrackingEditor}
                                className="rounded border border-gray-300 px-3 py-2 text-sm"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveTracking(card)}
                                disabled={saving}
                                className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
