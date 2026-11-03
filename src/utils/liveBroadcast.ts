import { supabase } from "./supabase";

export const LIVE_SYNC_CHANNEL_NAME = "rpc-live-broadcast-v1";

export type CatalogBroadcastKey = "packages" | "menu" | "inclusions";
export type InventoryBroadcastScope = "items" | "deductions" | "movements" | "rules" | "all";

type CatalogListener = (key: CatalogBroadcastKey) => void;
type InventoryListener = (scope: InventoryBroadcastScope) => void;
type AuditListener = (payload: { action: "insert" | "clear"; log?: any }) => void;

const catalogListeners = new Set<CatalogListener>();
const inventoryListeners = new Set<InventoryListener>();
const auditListeners = new Set<AuditListener>();

let sharedBroadcastChannel: ReturnType<typeof supabase.channel> | null = null;

function ensureBroadcastChannel() {
  if (sharedBroadcastChannel) return sharedBroadcastChannel;

  sharedBroadcastChannel = supabase
    .channel(LIVE_SYNC_CHANNEL_NAME, {
      config: { broadcast: { self: true } },
    })
    .on("broadcast", { event: "catalog_change" }, (msg: any) => {
      const key = msg?.payload?.key as CatalogBroadcastKey | undefined;
      if (!key) return;
      catalogListeners.forEach((fn) => {
        try {
          fn(key);
        } catch (err) {
          console.error("[liveBroadcast] catalog listener error:", err);
        }
      });
    })
    .on("broadcast", { event: "inventory_change" }, (msg: any) => {
      const scope = (msg?.payload?.scope || "all") as InventoryBroadcastScope;
      inventoryListeners.forEach((fn) => {
        try {
          fn(scope);
        } catch (err) {
          console.error("[liveBroadcast] inventory listener error:", err);
        }
      });
    })
    .on("broadcast", { event: "audit_change" }, (msg: any) => {
      const data = msg?.payload || { action: "insert" };
      auditListeners.forEach((fn) => {
        try {
          fn(data);
        } catch (err) {
          console.error("[liveBroadcast] audit listener error:", err);
        }
      });
    })
    .subscribe();

  return sharedBroadcastChannel;
}

export async function broadcastCatalogChange(key: CatalogBroadcastKey) {
  try {
    const ch = ensureBroadcastChannel();
    await ch.send({
      type: "broadcast",
      event: "catalog_change",
      payload: { key, ts: Date.now() },
    });
  } catch (err) {
    console.warn("[liveBroadcast] catalog send warning:", err);
  }
}

export async function broadcastInventoryChange(scope: InventoryBroadcastScope = "all") {
  try {
    const ch = ensureBroadcastChannel();
    await ch.send({
      type: "broadcast",
      event: "inventory_change",
      payload: { scope, ts: Date.now() },
    });
  } catch (err) {
    console.warn("[liveBroadcast] inventory send warning:", err);
  }
}

export async function broadcastAuditChange(action: "insert" | "clear", log?: any) {
  try {
    const ch = ensureBroadcastChannel();
    await ch.send({
      type: "broadcast",
      event: "audit_change",
      payload: { action, log, ts: Date.now() },
    });
  } catch (err) {
    console.warn("[liveBroadcast] audit send warning:", err);
  }
}

export function subscribeCatalogBroadcast(listener: CatalogListener): () => void {
  catalogListeners.add(listener);
  ensureBroadcastChannel();
  return () => {
    catalogListeners.delete(listener);
  };
}

export function subscribeInventoryBroadcast(listener: InventoryListener): () => void {
  inventoryListeners.add(listener);
  ensureBroadcastChannel();
  return () => {
    inventoryListeners.delete(listener);
  };
}

export function subscribeAuditBroadcast(listener: AuditListener): () => void {
  auditListeners.add(listener);
  ensureBroadcastChannel();
  return () => {
    auditListeners.delete(listener);
  };
}

