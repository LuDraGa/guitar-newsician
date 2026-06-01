import { NextResponse } from "next/server";

import { getModalGatewayUrl, modalFetch } from "@/lib/modal/client";

export const dynamic = "force-dynamic";

type ModalHealth = {
  status: string;
  service: string;
  version: string;
  model_loaded: boolean;
  gpu_required: boolean;
};

export async function GET() {
  try {
    const modal = await modalFetch<ModalHealth>("/health");

    return NextResponse.json({
      status: "healthy",
      app: "werecode-next",
      modal,
      modalGatewayUrl: getModalGatewayUrl(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        app: "werecode-next",
        modalGatewayUrl: getModalGatewayUrl(),
        error: error instanceof Error ? error.message : "Unknown Modal health error",
      },
      { status: 502 },
    );
  }
}
