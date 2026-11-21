import { supabase } from "./supabase";

export const LIVE_SYNC_CHANNEL_NAME = "rpc-live-broadcast-v1";

export type CatalogBroadcastKey = "packages" | "menu" | "inclusions";
export type InventoryBroadcastScope = "items" | "deductions" | "movements" | "rules" | "all";

type CatalogListener = (key: CatalogBroadcastKey) => void;
type InventoryListener = (scope: InventoryBroadcastScope) => void;
type AuditListener = (payload: { action: "insert" }) => void;
type CmsListener = (sections: string[]) => void;

const catalogListeners = new Set<CatalogListener>();
const inventoryListeners = new Set<InventoryListener>();
const auditListeners = new Set<AuditListener>();
const cmsListeners = new Set<CmsListener>();

let sharedBroadcastChannel: ReturnType<typeof supabase.channel> | null = null;
let isChannelSubscribed = false;

function dispatchCatalog(key?: CatalogBroadcastKey) {
  if (!key) return;
  catalogListeners.forEach((fn) => {
    try {
      fn(key);
    } catch (err) {
      console.error("[liveBroadcast] catalog listener error:", err);
    }
  });
}

function dispatchInventory(scope: InventoryBroadcastScope) {
  inventoryListeners.forEach((fn) => {
    try {
      fn(scope);
    } catch (err) {
      console.error("[liveBroadcast] inventory listener error:", err);
    }
  });
}

function dispatchAudit(action?: string) {
  if (action !== "insert") return;
  auditListeners.forEach((fn) => {
    try {
      fn({ action: "insert" });
    } catch (err) {
      console.error("[liveBroadcast] audit listener error:", err);
    }
  });
}

function dispatchCms(sections: unknown) {
  const normalized = Array.isArray(sections)
    ? sections.filter((s): s is string => typeof s === "string")
    : [];
  cmsListeners.forEach((fn) => {
    try {
      fn(normalized);
    } catch (err) {
      console.error("[liveBroadcast] cms listener error:", err);
    }
  });
}

function notifyLocalListeners(event: string, payload: Record<string, any>) {
  if (event === "catalog_change") {
    dispatchCatalog(payload?.key as CatalogBroadcastKey | undefined);
  } else if (event === "inventory_change") {
    dispatchInventory((payload?.scope || "all") as InventoryBroadcastScope);
  } else if (event === "audit_change") {
    dispatchAudit(payload?.action);
  } else if (event === "cms_change") {
    dispatchCms(payload?.sections);
  }
}

function ensureBroadcastChannel() {
  if (sharedBroadcastChannel) return sharedBroadcastChannel;

  sharedBroadcastChannel = supabase
    .channel(LIVE_SYNC_CHANNEL_NAME, {
      config: { broadcast: { self: true } },
    })
    .on("broadcast", { event: "catalog_change" }, (msg: any) => {
      dispatchCatalog(msg?.payload?.key as CatalogBroadcastKey | undefined);
    })
    .on("broadcast", { event: "inventory_change" }, (msg: any) => {
      dispatchInventory((msg?.payload?.scope || "all") as InventoryBroadcastScope);
    })
    .on("broadcast", { event: "audit_change" }, (msg: any) => {
      dispatchAudit(msg?.payload?.action);
    })
    .on("broadcast", { event: "cms_change" }, (msg: any) => {
      dispatchCms(msg?.payload?.sections);
    })
    .subscribe((status) => {
      isChannelSubscribed = status === "SUBSCRIBED";
    });

  return sharedBroadcastChannel;
}

async function sendBroadcast(event: string, payload: Record<string, any>) {
  const ch = ensureBroadcastChannel();
  if (isChannelSubscribed) {
    await ch.send({
      type: "broadcast",
      event,
      payload,
    });
  } else {
    const res = await ch.httpSend(event, payload);
    if ("error" in res) {
      console.warn(`[liveBroadcast] httpSend ${event} warning:`, res.error);
    }
    notifyLocalListeners(event, payload);
  }
}

export async function broadcastCatalogChange(key: CatalogBroadcastKey) {
  try {
    await sendBroadcast("catalog_change", { key, ts: Date.now() });
  } catch (err) {
    console.warn("[liveBroadcast] catalog send warning:", err);
  }
}

export async function broadcastInventoryChange(scope: InventoryBroadcastScope = "all") {
  try {
    await sendBroadcast("inventory_change", { scope, ts: Date.now() });
  } catch (err) {
    console.warn("[liveBroadcast] inventory send warning:", err);
  }
}

export async function broadcastAuditChange(action: "insert") {
  try {
    await sendBroadcast("audit_change", { action, ts: Date.now() });
  } catch (err) {
    console.warn("[liveBroadcast] audit send warning:", err);
  }
}

export async function broadcastCmsChange(sections: string[] = []) {
  try {
    await sendBroadcast("cms_change", { sections, ts: Date.now() });
  } catch (err) {
    console.warn("[liveBroadcast] cms send warning:", err);
  }
}

export async function broadcastSlotsChange() {
  try {
    await sendBroadcast("slots_change", { ts: Date.now() });
  } catch (err) {
    console.warn("[liveBroadcast] slots send warning:", err);
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

export function subscribeCmsBroadcast(listener: CmsListener): () => void {
  cmsListeners.add(listener);
  ensureBroadcastChannel();
  return () => {
    cmsListeners.delete(listener);
  };
}
