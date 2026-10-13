/* Şikâyet olay günlüğü — denetim izi ve zaman çizelgesi. */

import { all, run } from "@/lib/db";
import type { EventView } from "@/lib/types";

export interface LogInput {
  complaintId: number;
  type: string;
  title: string;
  note?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorId?: number | null;
  actorLabel?: string | null;
  payload?: unknown;
}

export function logEvent(input: LogInput): void {
  run(
    `INSERT INTO complaint_events
       (complaint_id, type, title, note, from_status, to_status, actor_id, actor_label, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.complaintId,
    input.type,
    input.title,
    input.note ?? null,
    input.fromStatus ?? null,
    input.toStatus ?? null,
    input.actorId ?? null,
    input.actorLabel ?? null,
    input.payload === undefined ? null : JSON.stringify(input.payload),
  );
}

export function complaintEvents(complaintId: number): EventView[] {
  return all<EventView>(
    `SELECT e.*, u.full_name AS actor_name, u.title AS actor_title
       FROM complaint_events e
       LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.complaint_id = ?
      ORDER BY e.id DESC`,
    complaintId,
  );
}

export const EVENT_TYPE = {
  KAYIT: "KAYIT",
  DURUM: "DURUM",
  EKIP: "EKIP",
  YONLENDIRME: "YONLENDIRME",
  INCELEME: "INCELEME",
  NUMUNE: "NUMUNE",
  ANALIZ: "ANALIZ",
  BELGE: "BELGE",
  IMZA: "IMZA",
  KARAR: "KARAR",
  ITIRAZ: "ITIRAZ",
  ISLEM: "ISLEM",
  CAPA: "CAPA",
  RESMI_YAZI: "RESMI_YAZI",
  BILDIRIM: "BILDIRIM",
  GOREV: "GOREV",
  EK: "EK",
  KAPANIS: "KAPANIS",
  NOT: "NOT",
} as const;
