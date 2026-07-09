import { NextResponse } from 'next/server';
import { search, SafeSearchType } from 'duck-duck-scrape';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const searchResults = await search(query, {
      safeSearch: SafeSearchType.MODERATE,
    });

    const formattedResults = searchResults.results.slice(0, 10).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
      domain: new URL(r.url).hostname.replace(/^www\./, '')
    }));

    return NextResponse.json({ results: formattedResults });
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ error: "Failed to perform web search" }, { status: 500 });
  }
}
