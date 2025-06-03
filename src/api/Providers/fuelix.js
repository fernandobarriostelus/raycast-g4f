import { messages_to_json } from "../../classes/message.js";
import fetch from "#root/src/api/fetch.js";
import { Preferences } from "../preferences.js";

export const getModels = async (url, apiKey, type) => {
  url = url + "/models";
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: apiKey ? `Bearer ${apiKey}` : undefined,
    },
  });
  const data = (await response.json()).data;
  const res = data.map((x) => x.id || x.modelId || null).filter((x) => x !== null);
  return res;
};

export const FuelIXProvider = {
  name: "FuelIX",
  models: [
    {
      "model": "aia-gpt-4o",
      stream: true,
    },
    {
      "model": "claude-3-7-sonnet",
      stream: true,
    },
    {
      "model": "claude-4-sonnet",
      stream: true,
    },
    {
      "model": "cursor-c-3-7-sonnet",
      stream: true,
    },
    {
      "model": "dall-e-3",
      stream: true,
    },
    {
      "model": "gemini-2.5-flash",
      stream: true,
    },
    {
      "model": "gemini-2.5-pro",
      stream: true,
    },
    {
      "model": "gpt-4.1",
      stream: true,
    },
    {
      "model": "gpt-4o",
      stream: true,
    },
    {
      "model": "gpt-4o-mini",
      stream: true,
    },
    {
      "model": "imagen-3",
      stream: true,
    },
    {
      "model": "imagen-3-fast",
      stream: true,
    },
    {
      "model": "llama-3.3-70b",
      stream: true,
    },
    {
      "model": "o1-mini",
      stream: true,
    },
    {
      "model": "o3-mini",
      stream: true,
    },
    {
      "model": "o4-mini",
      stream: true,
    },
    {
      "model": "whisper-1",
      stream: true,
    }
  ],
  info: {
    type: "OpenAI",
  },
  generate: async function* (chat, options) {
    const apiKey = Preferences["FuelIXAPIKey"];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let { url, model, config: reqConfig, ...reqBody } = options;

    // Initialize
    const api_url = "https://api-beta.fuelix.ai/chat/completions";
    // The order for applying configs: reqBody -> apiData.config -> reqConfig
    const config = { ...reqBody, ...reqConfig };

    chat = messages_to_json(chat);


    let headers = {
      Authorization: apiKey ? `Bearer ${apiKey}` : undefined,
      ...config?.HEADERS,
    };

    delete config.HEADERS;

    // Prepare the request body
    let body = {
      messages: chat,
      stream: true,
      model: model,
      ...config,
    };

    let response = await fetch(
      api_url,
      {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body),
      },
      { timeout: 0 } // disable timeout
    );

    const reader = response.body;
    let buffer = "";

    const processBuffer = (buffer) => {
      const lines = buffer.split("\n");
      const leftover = lines.pop();
      const chunks = [];

      for (let raw of lines) {
        let line = raw.trim();
        if (line.startsWith("data: ")) {
          line = line.slice(6);
        }
        if (!line || line === "[DONE]") continue;
        try {
          const json = JSON.parse(line);
          const chunk = this.getChunk(json);
          if (chunk) chunks.push(chunk);
        } catch (e) {
          console.log("parse error:", e);
        }
      }

      return { leftover, chunks };
    };

    // stream loop
    for await (const part of reader) {
      buffer += part.toString();
      const { leftover, chunks } = processBuffer(buffer);
      buffer = leftover;
      for (const c of chunks) yield c;
    }

    // final leftover
    const { chunks } = processBuffer(buffer);
    for (const c of chunks) yield c;
  },
  getChunk: function (json) {
    let chunk = json["choices"][0]["delta"] ?? json["choices"][0]["message"];
    chunk = chunk?.content;
    return chunk;
  },
};
