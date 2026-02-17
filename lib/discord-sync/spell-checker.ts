interface NaverSpellResponse {
  message?: {
    result?: {
      notag_html?: string;
    };
  };
}

const NAVER_SPELLER_URL = 'https://m.search.naver.com/p/csearch/ocontent/util/SpellerProxy';

export async function correctSpelling(text: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }

  if (text.length > 500) {
    return text;
  }

  try {
    const params = new URLSearchParams({
      q: text,
      where: 'nexearch',
      color_blindness: '0',
    });

    const response = await fetch(`${NAVER_SPELLER_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Referer: 'https://m.search.naver.com/',
      },
    });

    if (!response.ok) {
      return text;
    }

    const data = (await response.json()) as NaverSpellResponse;
    return data.message?.result?.notag_html ?? text;
  } catch {
    return text;
  }
}
