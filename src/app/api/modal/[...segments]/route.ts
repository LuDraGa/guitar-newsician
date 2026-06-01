import { NextRequest } from "next/server";

import { getModalGatewayUrl } from "@/lib/modal/client";

export const dynamic = "force-dynamic";

const ALLOWED_METADATA_PATHS = new Set(["/health", "/models", "/api-info"]);

type RouteContext = {
  params: Promise<{
    segments: string[];
  }>;
};

async function proxyModalRequest(request: NextRequest, context: RouteContext) {
  const { segments } = await context.params;
  const path = `/${segments.join("/")}`;

  if (!ALLOWED_METADATA_PATHS.has(path)) {
    return Response.json(
      {
        error: {
          code: "modal_proxy_restricted",
          message: "Modal compute endpoints must be invoked through Next workflow APIs.",
        },
      },
      { status: 404 }
    );
  }

  const targetUrl = new URL(path, getModalGatewayUrl());

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  headers.set("accept", request.headers.get("accept") ?? "application/json");

  const token = process.env.MODAL_GATEWAY_TOKEN;
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

  const response = await fetch(targetUrl, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxyModalRequest(request, context);
}
