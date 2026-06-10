import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionWereCodeUser } from "@/server/werecode/membership";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (error) {
    const redirectUrl = new URL("/app/library", requestUrl.origin);
    redirectUrl.searchParams.set("authError", errorDescription ?? error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL("/app/library", requestUrl.origin);
    redirectUrl.searchParams.set("authError", "Missing OAuth code");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      throw exchangeError;
    }

    if (!data.user) {
      throw new Error("Could not resolve Supabase user after Google sign in");
    }

    await provisionWereCodeUser(data.user);
  } catch (exchangeError) {
    const redirectUrl = new URL("/app/library", requestUrl.origin);
    redirectUrl.searchParams.set(
      "authError",
      exchangeError instanceof Error ? exchangeError.message : "Could not complete Google sign in",
    );
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL("/app/library", requestUrl.origin));
}
