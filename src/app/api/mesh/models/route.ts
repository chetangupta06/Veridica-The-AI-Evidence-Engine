import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get("Authorization");

    if (!apiKey) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const meshUrl = "https://api.meshapi.ai/v1/models";

    const response = await fetch(meshUrl, {
      method: "GET",
      headers: {
        "Authorization": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Mesh API Error:", response.status, errorText);
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Mesh models route error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
