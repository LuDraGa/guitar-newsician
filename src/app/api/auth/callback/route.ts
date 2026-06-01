import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (error) {
    const redirectUrl = new URL("/library", requestUrl.origin);
    redirectUrl.searchParams.set("authError", errorDescription ?? error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL("/library", requestUrl.origin);
    redirectUrl.searchParams.set("authError", "Missing OAuth code");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      throw exchangeError;
    }
  } catch (exchangeError) {
    const redirectUrl = new URL("/library", requestUrl.origin);
    redirectUrl.searchParams.set(
      "authError",
      exchangeError instanceof Error ? exchangeError.message : "Could not complete Google sign in",
    );
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL("/library", requestUrl.origin));
}
