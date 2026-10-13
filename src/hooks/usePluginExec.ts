import { TLSN_MODE } from "../lib/config";
import { useState, useCallback } from "react";

// Plugin execution types
export interface PluginResult {
  success: boolean;
  output?: string;
  error?: string;
  results?: Array<{ type: string; part?: string; value: string }>;
  timestamp: number;
}

declare global {
  interface Window {
    tlsn?: {
      version?: string;
      execCode: (
        pluginCode: string,
        options: { requestId: string; sessionData?: Record<string, string> },
      ) => Promise<unknown>;
    };
  }
}

export const usePluginExecution = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<PluginResult | null>(null);

  const execute = useCallback(async (code: string, sessionData: Record<string, string> = {}): Promise<PluginResult> => {
    setIsExecuting(true);
    setResult(null);

    try {
      if (!window.tlsn?.execCode) {
        throw new Error(
          "TLSNotary extension not found. Please ensure the extension is installed.",
        );
      }

      // Proxy mode for the Cloudflare verifier, MPC for the enclave (lib/config).
      const resultString = await window.tlsn.execCode(code, {
        requestId: `req_${Date.now()}`,
        sessionData: { ...sessionData, mode: TLSN_MODE },
      });

      if (!resultString || typeof resultString !== "string") {
        throw new Error(
          "Plugin execution failed. Check console logs for details.",
        );
      }

      const parsed = JSON.parse(resultString);

      const pluginResult: PluginResult = {
        success: true,
        output: resultString,
        results: parsed.results || [],
        timestamp: Date.now(),
      };

      setResult(pluginResult);
      return pluginResult;
    } catch (error) {
      const pluginResult: PluginResult = {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: Date.now(),
      };

      setResult(pluginResult);
      return pluginResult;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setIsExecuting(false);
  }, []);

  return { execute, isExecuting, result, reset };
};
