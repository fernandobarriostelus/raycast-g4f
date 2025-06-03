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
    },
    {
      "model": "claude-3-7-sonnet",
    },
    {
      "model": "claude-4-sonnet",
    },
    {
      "model": "cursor-c-3-7-sonnet",
    },
    {
      "model": "dall-e-3",
    },
    {
      "model": "gemini-2.5-flash",
    },
    {
      "model": "gemini-2.5-pro",
    },
    {
      "model": "gpt-4.1",
    },
    {
      "model": "gpt-4o",
    },
    {
      "model": "gpt-4o-mini",
    },
    {
      "model": "imagen-3",
    },
    {
      "model": "imagen-3-fast",
    },
    {
      "model": "llama-3.3-70b",
    },
    {
      "model": "o1-mini",
    },
    {
      "model": "o3-mini",
    },
    {
      "model": "o4-mini",
    },
    {
      "model": "whisper-1",
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
    switch (this.info?.type) {
      case "Anthropic": {
        let chunk = "";
        if (json["delta"]["thinking"]) {
          if (!this.isThinking) {
            this.isThinking = true;
            chunk += "\n<thinking>\n";
          }
          chunk += json["delta"]["thinking"];
        }
        if (json["delta"]["text"]) {
          if (this.isThinking) {
            this.isThinking = false;
            chunk += "\n</thinking>\n\n";
          }
          chunk += json["delta"]["text"];
        }
        return chunk;
      }
      case "OpenAI":
      default: {
        let chunk = json["choices"][0]["delta"] ?? json["choices"][0]["message"];
        chunk = chunk?.content;
        return chunk;
      }
    }
  },
};
