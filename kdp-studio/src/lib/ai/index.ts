import "server-only";
import type { ImageAIProvider, TextAIProvider } from "./types";
import { OpenAITextProvider } from "./openai-text-provider";
import { MockTextProvider } from "./mock-text-provider";
import { OpenAIImageProvider } from "./openai-image-provider";
import { MockImageProvider } from "./mock-image-provider";

// Provider selection. TEXT_PROVIDER=openai|mock; when unset, OpenAI is used
// if a key is configured, otherwise the built-in sample generator.

export function getTextProvider(): TextAIProvider {
  const requested = process.env.TEXT_PROVIDER?.toLowerCase();
  const key = process.env.OPENAI_API_KEY;

  if (requested === "mock") return new MockTextProvider();
  if (requested === "openai") {
    if (!key) throw new Error("TEXT_PROVIDER=openai but OPENAI_API_KEY is not set");
    return new OpenAITextProvider(key);
  }
  return key ? new OpenAITextProvider(key) : new MockTextProvider();
}

/** Safe-to-render provider info for the UI (no secrets). */
export function getTextProviderInfo(): { name: string; isSample: boolean } {
  const provider = getTextProvider();
  return { name: provider.name, isSample: provider.name === "mock" };
}

// IMAGE_PROVIDER=openai|mock; when unset, OpenAI is used if a key is
// configured, otherwise the built-in placeholder renderer.

export function getImageProvider(): ImageAIProvider {
  const requested = process.env.IMAGE_PROVIDER?.toLowerCase();
  const key = process.env.OPENAI_API_KEY;

  if (requested === "mock") return new MockImageProvider();
  if (requested === "openai") {
    if (!key) throw new Error("IMAGE_PROVIDER=openai but OPENAI_API_KEY is not set");
    return new OpenAIImageProvider(key);
  }
  return key ? new OpenAIImageProvider(key) : new MockImageProvider();
}

/** Safe-to-render provider info for the UI (no secrets). */
export function getImageProviderInfo(): { name: string; isSample: boolean } {
  const provider = getImageProvider();
  return { name: provider.name, isSample: provider.name === "mock" };
}
