export interface AiRecommendation {
  id: string;
  title: string;
  observation: string;
  metric: string;
  suggestedAction: string;
  confidence: 'High' | 'Medium' | 'Directional';
  category: 'inventory' | 'merchandising' | 'pricing' | 'marketing';
}

export interface AiInsightsResult {
  isConfigured: boolean;
  modelUsed?: string;
  recommendations: AiRecommendation[];
  summary?: string;
  error?: string;
}

const LOCAL_KEY = 'nova_gemini_api_key';

export const getGeminiApiKey = (): string => {
  try {
    const local = window.localStorage.getItem(LOCAL_KEY);
    if (local && local.trim()) return local.trim();
  } catch {}

  const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (viteKey && typeof viteKey === 'string' && viteKey.trim()) return viteKey.trim();

  const procKey = typeof process !== 'undefined' ? (process.env as any)?.GEMINI_API_KEY : '';
  if (procKey && typeof procKey === 'string' && procKey.trim()) return procKey.trim();

  return '';
};

export const saveGeminiApiKey = (key: string): void => {
  try {
    if (!key || !key.trim()) {
      window.localStorage.removeItem(LOCAL_KEY);
    } else {
      window.localStorage.setItem(LOCAL_KEY, key.trim());
    }
  } catch {}
};

/**
 * Generate Actionable AI Recommendations using Google Gemini
 * Strictly grounds recommendations in verified aggregated store metrics.
 */
export const generateAiMarketInsights = async (metricsPayload: {
  vendorName: string;
  reportingPeriod: string;
  totalRevenue: number;
  totalOrders: number;
  unitsSold: number;
  totalViews: number;
  totalArTryOns: number;
  topCategories: Array<{ name: string; revenue: number; units: number }>;
  topProducts: Array<{ name: string; category: string; units: number; revenue: number; stock: number }>;
  zeroResultSearches: string[];
  biggestFunnelDrop: string;
  lowStockItems: Array<{ name: string; stock: number }>;
}): Promise<AiInsightsResult> => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return {
      isConfigured: false,
      recommendations: [],
      error: 'Google Gemini API key is not configured. Enter an API key to enable live AI analysis.'
    };
  }

  // Anonymized aggregate prompt — strictly metrics, zero customer PII
  const systemInstruction = `You are an elite B2B retail supply chain and clothing commerce analytics consultant.
Analyze the provided store performance metrics for ${metricsPayload.vendorName} (${metricsPayload.reportingPeriod}).
Generate 3 to 4 high-impact, grounded recommendations based strictly on the provided data.
Distinguish observations from predictions. Never fabricate figures.

Respond ONLY with a valid JSON object matching this structure:
{
  "summary": "Brief 1-2 sentence overview of commercial momentum",
  "recommendations": [
    {
      "id": "rec_1",
      "title": "Short punchy title (max 6 words)",
      "observation": "What the data shows clearly and factually",
      "metric": "Exact supporting metric or ratio from the data",
      "suggestedAction": "Concrete business or supplier step to take",
      "confidence": "High" | "Medium" | "Directional",
      "category": "inventory" | "merchandising" | "pricing" | "marketing"
    }
  ]
}`;

  const userContent = JSON.stringify({
    period: metricsPayload.reportingPeriod,
    earnedRevenue: `INR ${metricsPayload.totalRevenue}`,
    totalOrders: metricsPayload.totalOrders,
    unitsSold: metricsPayload.unitsSold,
    catalogViews: metricsPayload.totalViews,
    virtualArTryOns: metricsPayload.totalArTryOns,
    topCategories: metricsPayload.topCategories,
    topProducts: metricsPayload.topProducts,
    unmetSearchQueriesZeroResults: metricsPayload.zeroResultSearches,
    discoveryFunnelBottleneck: metricsPayload.biggestFunnelDrop,
    lowStockActiveItems: metricsPayload.lowStockItems
  }, null, 2);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemInstruction },
              { text: `Store Metrics Dataset:\n${userContent}` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg = 'Failed to generate insights';
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || msg;
      } catch {}
      return {
        isConfigured: true,
        recommendations: [],
        error: `Gemini API Error (${response.status}): ${msg}`
      };
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return {
        isConfigured: true,
        recommendations: [],
        error: 'Gemini model returned an empty response.'
      };
    }

    const parsedJson = JSON.parse(candidateText);

    return {
      isConfigured: true,
      modelUsed: 'gemini-2.5-flash',
      summary: parsedJson.summary || 'Market analytics verified.',
      recommendations: Array.isArray(parsedJson.recommendations) ? parsedJson.recommendations : []
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      recommendations: [],
      error: `AI Generation failed: ${err.message || 'Unknown network error'}`
    };
  }
};
