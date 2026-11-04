const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.20:8000";

export type Options = {
  communities: string[];
  bedrooms: string[];
  bathrooms: string[];
};

export type ListingInput = {
  community: string;
  bedrooms: string;
  bathrooms: string;
  size_sqft: number;
  furnished: boolean;
  verified: boolean;
  title?: string;
  description?: string;
};

export type Prediction = {
  predicted_class: string;
  confidence: number;
  probabilities: Record<string, number>;
};

// FastAPI renvoie `detail` en texte (nos HTTPException) ou en liste (validation Pydantic)
function extractDetail(body: any, fallback: string): string {
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) {
    return body.detail
      .map((d: any) => `${(d.loc ?? []).slice(1).join(".")} : ${d.msg}`)
      .join("\n");
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error("Impossible de joindre l'API");
  }

  if (!response.ok) {
    let detail = `Erreur ${response.status}`;
    try {
      detail = extractDetail(await response.json(), detail);
    } catch {}
    throw new Error(detail);
  }
  return response.json();
}

export function getOptions(): Promise<Options> {
  return request<Options>("/options");
}

export function predict(listing: ListingInput): Promise<Prediction> {
  // Un champ texte vide n'est pas envoyé : l'API utilise alors sa valeur par défaut
  const body: Record<string, unknown> = { ...listing };
  if (!listing.title?.trim()) delete body.title;
  else body.title = listing.title.trim();
  if (!listing.description?.trim()) delete body.description;
  else body.description = listing.description.trim();

  return request<Prediction>("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}