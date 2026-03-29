const AURORIAN_IMAGE_BASE =
  "https://aurorians.cdn.aurory.io/aurorians-v2/current/images/mini";

interface HeliusAsset {
  id: string;
  content?: {
    metadata?: {
      name?: string;
    };
    links?: {
      image?: string;
    };
  };
  grouping?: Array<{
    group_key: string;
    group_value: string;
  }>;
}

// Extract Aurorian number from name like "Aurorian #3001"
function parseAurorianNumber(name: string): number | null {
  const match = name.match(/#(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Known Aurory collection addresses
const AURORY_COLLECTIONS = [
  "aurory", // slug
];

export async function getAuroriansForMints(
  mintAddresses: string[]
): Promise<Map<string, { number: number; imageUrl: string }>> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    throw new Error("HELIUS_API_KEY not configured");
  }

  const result = new Map<string, { number: number; imageUrl: string }>();

  // Batch in chunks of 1000
  for (let i = 0; i < mintAddresses.length; i += 1000) {
    const batch = mintAddresses.slice(i, i + 1000);

    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "daory-vote",
          method: "getAssetBatch",
          params: { ids: batch },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const data = await response.json();
    const assets: HeliusAsset[] = data.result || [];

    for (const asset of assets) {
      const name = asset.content?.metadata?.name || "";
      const num = parseAurorianNumber(name);

      if (num !== null) {
        result.set(asset.id, {
          number: num,
          imageUrl: `${AURORIAN_IMAGE_BASE}/${num}.png`,
        });
      }
    }
  }

  return result;
}
