import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth/session";
import { DashboardApp } from "@/components/dashboard/dashboard-app";

export const metadata: Metadata = { title: "Dashboard · Gaming Community Pulse" };

export default async function DashboardPage() {
  if (!(await getSessionFromCookies())) redirect("/login");
  return <DashboardApp />;
}
