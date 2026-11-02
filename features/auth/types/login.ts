export type Role = "user" | "manager" | "professional" | "admin";

export type speciality =
  "psicologo" | "assistente_social" | "assessor_juridico" | null;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  speciality: speciality;
}
