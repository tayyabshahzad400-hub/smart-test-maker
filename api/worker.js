const ALLOWED_ORIGIN = "https://tayyabshahzad400-hub.github.io";

function json(data, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-App-Password",
      "Vary": "Origin"
    }
  });
}

function makePrompt({ school, address, watermark, language, design, extraInstructions }) {
  return `
You are an experienced school examination paper setter and professional bilingual document designer.
Inspect the attached original PTS PDF visually, page by page. Treat it as the authoritative reference for class, subject, syllabus scope, paper structure, section sequence, question types, marks distribution, difficulty level, MCQ option pattern, Urdu/English mix, and exam conventions.

Create a NEW examination paper for the same class, subject and syllabus scope. Match the source's academic standard and structure. Do not merely change the institution name or copy the source paper verbatim. Write fresh questions that assess the same concepts and learning outcomes. Do not invent chapter names, dates, codes, or facts that are not visible in the reference. If a key detail cannot be read, use an empty string rather than guessing.

IMPORTANT LANGUAGE RULES:
- Urdu must be proper Urdu, not Arabic substitutions or Arabic paraphrasing.
- Write Urdu in normal Unicode logical order. Keep Urdu phrases natural and grammatically correct.
- Preserve English words and mathematical expressions in their correct order.
- Use plain Unicode mathematical notation where possible (fractions, powers, roots, symbols); do not omit a formula.
- For a bilingual question, include both language versions only where the reference does so.
- Do not include any original school's identifying name, logo, phone, address, or watermark.

REBRANDING:
Institution name: ${school}
Institution address: ${address || "Not supplied; omit it"}
Watermark on every page: ${watermark || school}
Language requested: ${language}
Design direction: ${design}

${extraInstructions || ""}

Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "title": "EXAMINATION PAPER",
  "className": "",
  "subject": "",
  "paperCode": "",
  "examDate": "",
  "timeAllowed": "",
  "totalMarks": "",
  "syllabus": "",
  "instructions": ["..."],
  "sections": [
    {
      "title": "SECTION A — OBJECTIVE",
      "marks": "",
      "questions": [
        {
          "number": "1",
          "type": "mcq",
          "text": "Question text; use Urdu Unicode where required",
          "marks": "1",
          "options": ["A) ...", "B) ...", "C) ...", "D) ..."]
        }
      ]
    }
  ]
}
Ensure all question counts and marks add up to the total marks. Include every option for MCQs. Use a reasonable number of fresh questions matching the source paper. Keep instructions concise. Do not include markdown or HTML in field values.
`.trim();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== ALLOWED_ORIGIN) {
      return new Response("Origin not allowed", { status: 403 });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-App-Password",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }
    if (request.method !== "POST") return json({ error: "Use POST." }, 405);
    if (!env.GEMINI_API_KEY || !env.APP_ACCESS_PASSWORD) {
      return json({ error: "Backend setup incomplete. Add GEMINI_API_KEY and APP_ACCESS_PASSWORD as Worker secrets." }, 503);
    }
    const supplied = request.headers.get("X-App-Password") || "";
    if (supplied.length < 12 || supplied !== env.APP_ACCESS_PASSWORD) {
      return json({ error: "Access password is incorrect." }, 401);
    }

    try {
      const form = await request.formData();
      const file = form.get("referencePdf");
      if (!file || typeof file.arrayBuffer !== "function" || file.type !== "application/pdf") {
        return json({ error: "Please upload an original PDF file." }, 400);
      }
      if (file.size < 100 || file.size > 18 * 1024 * 1024) {
        return json({ error: "PDF must be between 100 bytes and 18 MB for this version." }, 413);
      }
      const school = String(form.get("school") || "").trim().slice(0, 160);
      const address = String(form.get("address") || "").trim().slice(0, 240);
      const watermark = String(form.get("watermark") || school).trim().slice(0, 160);
      const language = String(form.get("language") || "Same as reference paper").slice(0, 80);
      const design = String(form.get("design") || "Professional school exam").slice(0, 120);
      const extraInstructions = String(form.get("extraInstructions") || "").slice(0, 1200);
      if (!school) return json({ error: "Enter your school or academy name." }, 400);

      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const prompt = makePrompt({ school, address, watermark, language, design, extraInstructions });
      const model = env.GEMINI_MODEL || "gemini-3.8-flash";
      const apiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: prompt },
                { inline_data: { mime_type: "application/pdf", data: base64 } }
              ]
            }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.45,
              maxOutputTokens: 8192
            }
          })
        }
      );
      const apiData = await apiResponse.json().catch(() => ({}));
      if (!apiResponse.ok) {
        const message = apiData?.error?.message || "AI provider rejected the request.";
        return json({ error: message.slice(0, 500) }, apiResponse.status >= 500 ? 502 : 400);
      }
      const raw = apiData?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
      if (!raw) return json({ error: "AI returned no paper content. Try again with a clearer or smaller PDF." }, 502);
      let paper;
      try {
        paper = JSON.parse(raw.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, ""));
      } catch {
        return json({ error: "AI response was not valid structured paper data. Please retry." }, 502);
      }
      if (!paper || !Array.isArray(paper.sections) || !paper.sections.length) {
        return json({ error: "AI response did not contain paper sections. Please retry." }, 502);
      }
      return json({ paper, model, message: "Paper generated. Review every question and marks before printing." });
    } catch (error) {
      return json({ error: (error?.message || "Unexpected backend error").slice(0, 400) }, 500);
    }
  }
};
