import type { ManagerAppointmentDetail } from "../../manager/appointmentUtils";
import type { FridaDraft, FridaRecord } from "./fridaTypes";

export type FridaPageRole = "manager" | "professional";

export type FridaPageMode = "create" | "edit" | "read" | "blocked";

export type FridaPageSuccess = {
  ok: true;
  appointment: ManagerAppointmentDetail;
  frida: FridaRecord | null;
  mode: FridaPageMode;
  blockReason: string | null;
  initialDraft: FridaDraft | null;
};

export type FridaPageFailure = {
  ok: false;
  loadError: string;
};

export type FridaPageData = FridaPageSuccess | FridaPageFailure;

export type FridaActionData =
  | { ok: true; fridaId: string; mode: "create" | "update" }
  | { ok: false; error: string };
