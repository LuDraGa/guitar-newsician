import "server-only";

export type ModalEndpointInfo = {
  endpoint: string;
  method: string;
  description: string;
  inputs?: Record<string, string>;
  outputs?: Record<string, string>;
  example?: string | null;
};

export type ModalApiInfo = {
  service: string;
  version: string;
  description: string;
  endpoints: ModalEndpointInfo[];
};

export type ModalModelInfo = {
  name: string;
  purpose: string;
  status: "available" | "available_lazy" | "planned" | "placeholder";
  gpu: string | null;
  notes: string | null;
};

export type ModalModelsResponse = {
  service: string;
  models: ModalModelInfo[];
};

const FALLBACK_MODAL_GATEWAY_URL =
  "https://abhirooprasad--werecode-modal-apis-fastapi-app.modal.run";

export function getModalGatewayUrl() {
  return process.env.MODAL_GATEWAY_URL ?? FALLBACK_MODAL_GATEWAY_URL;
}

export async function modalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const gatewayUrl = getModalGatewayUrl();
  const url = new URL(path, gatewayUrl);
  const token = process.env.MODAL_GATEWAY_TOKEN;
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Modal request failed: ${response.status} ${response.statusText} ${details}`);
  }

  return (await response.json()) as T;
}

export function getModalApiInfo() {
  return modalFetch<ModalApiInfo>("/api-info");
}

export function getModalModels() {
  return modalFetch<ModalModelsResponse>("/models");
}
