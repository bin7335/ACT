import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentMember, googleConfigured } from "@/lib/auth";
import { safeReturnPath } from "@/lib/auth-credentials";
import { AuthModal } from "./AuthModal";

type Props = { mode: "login" | "signup"; searchParams: Promise<Record<string, string | string[] | undefined>> };
export function AuthModalRoute(props: Props) {
  return <Suspense fallback={null}><Content {...props} /></Suspense>;
}
async function Content({ mode, searchParams }: Props) {
  const params = await searchParams;
  const next = safeReturnPath(typeof params.next === "string" ? params.next : "/");
  if (await currentMember()) redirect(next);
  return <AuthModal initialMode={mode} next={next} googleEnabled={googleConfigured()} />;
}
