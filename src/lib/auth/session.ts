import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionToken } from "./token";

export async function getSessionFromCookies(): Promise<{ email: string } | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}
