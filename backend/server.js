import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import Groq from 'groq-sdk';

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Groq Client with timeout protection
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    timeout: 25 * 1000, // 25-second timeout per request so 120B never hangs indefinitely
    maxRetries: 1
});

// Configure Multer for multiple file uploads in memory
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
});

// Read models dynamically from .env with safe defaults
const ENV_MODELS = [
    process.env.PRIMARY_MODEL || 'openai/gpt-oss-20b',
    process.env.FALLBACK_MODEL_1 || 'openai/gpt-oss-120b',
    process.env.FALLBACK_MODEL_2 || 'qwen/qwen3.8-27b'
];

// Model Pricing Map (per 1 Million Tokens from Groq Docs)
const MODEL_PRICING = {
    'openai/gpt-oss-20b': { input: 0.075, output: 0.30 },
    'openai/gpt-oss-120b': { input: 0.15, output: 0.60 },
    'qwen/qwen3.8-27b': { input: 0.80, output: 4.00 }
};

/**
 * Helper: Rule-Based Script Pre-Parser
 * Uses Regex to deterministically extract episode number, logline, duration, and action/dialogue beats.
 */
function parseScriptMetadata(scriptText, fileName) {
    const episodeMatch = scriptText.match(/EPISODE NUMBER:\s*(.+)/i);
    const loglineMatch = scriptText.match(/EPISODE LOGLINE:\s*(.+)/i);
    const continuityMatch = scriptText.match(/CONTINUITY NOTES:\s*(.+)/i);
    
    const timeRegex = /Start:\s*\(?(\d{2}:\d{2}\.\d{2})\)?\s*\|\s*End:\s*\(?(\d{2}:\d{2}\.\d{2})\)?/g;
    let match;
    let maxEndSeconds = 0;
    let totalSegments = 0;

    while ((match = timeRegex.exec(scriptText)) !== null) {
        totalSegments++;
        const endParts = match[2].split(':');
        const endSec = parseInt(endParts[0], 10) * 60 + parseFloat(endParts[1]);
        if (endSec > maxEndSeconds) maxEndSeconds = endSec;
    }

    return {
        episodeTitle: episodeMatch ? episodeMatch[1].trim() : fileName.replace('.txt', ''),
        logline: loglineMatch ? loglineMatch[1].trim() : 'No logline provided.',
        continuityNotes: continuityMatch ? continuityMatch[1].trim() : '',
        totalDurationSeconds: Math.round(maxEndSeconds),
        totalTimestampedBeats: totalSegments
    };
}

/**
 * Helper: Convert MM:SS.ms timestamp string into numeric seconds
 */
function timestampToSeconds(ts) {
    if (!ts || typeof ts !== 'string') return 0;
    const cleanTs = ts.replace(/[()]/g, '').trim();
    const parts = cleanTs.split(':');
    if (parts.length !== 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
}

/**
 * GET /api/config
 * Returns configured .env models to the frontend so UI stays synced with .env
 */
app.get('/api/config', (req, res) => {
    res.status(200).json({
        status: 'success',
        primaryModel: ENV_MODELS[0],
        configuredModels: ENV_MODELS
    });
});

/**
 * POST /api/extract-promos
 * Processes single or multiple screenplay files with Auto-Fallback LLM execution and Rule Validation.
 */
app.post('/api/extract-promos', upload.array('scriptFiles', 55), async (req, res) => {
    try {
        const files = req.files;
        const requestedModel = req.body.model || ENV_MODELS[0];

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No script files provided. Please upload at least one .txt file.' });
        }

        // Build priority fallback queue starting with user/env selected model
        const modelQueue = [
            requestedModel,
            ...ENV_MODELS.filter(m => m !== requestedModel)
        ];

        const episodeResults = [];
        let allExtractedPromos = [];
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        let actualModelUsed = requestedModel;

        for (const file of files) {
            const scriptContent = file.buffer.toString('utf-8');
            const metadata = parseScriptMetadata(scriptContent, file.originalname);

            const systemPrompt = `You are a Principal Short-Form Video Editor & User Acquisition Strategist for vertical microdrama apps (Kuku TV, ReelShort, DramaBox).
Your task is to analyze the screenplay and extract 2 to 3 distinct promotional clips (promos) that will drive the highest viewer conversion on Instagram Reels, TikTok, and YouTube Shorts.

STRICT KUKUFM PROMO SPECIFICATIONS:
1. Total Duration: Strictly between 20 and 60 seconds per promo.
2. Continuous OR Multi-Segment: Provide at least one continuous stretch promo AND, if effective, one stitched multi-segment promo (joining 2-3 key moments in chronological order).
3. The 3-Second Hook: Must open on a high-impact visual or spoken hook in the first 3 seconds (a slap, a betrayal reveal, a shocking line, physical confrontation, or emotional humiliation).
4. The Cliffhanger Cut: Must end abruptly at an unresolved, high-tension beat so the viewer needs to watch the show to know what happens next.
5. Standalone Clarity: Must make complete sense to a cold viewer who has never seen the show. Include the actual spoken dialogue or action lines in your hook and cliffhanger descriptions.
6. Quality & Failure Check: Be brutally honest about where a promo might fail or where the episode script lacks strong ad potential.

Return STRICTLY a valid JSON object matching this exact structure:
{
  "promos": [
    {
      "promoTitle": "Catchy title for this promo angle",
      "promoType": "Continuous Clip" or "Multi-Segment Stitch",
      "segments": [
        {
          "segmentOrder": 1,
          "startTime": "00:11.00",
          "endTime": "00:43.90",
          "whatHappens": "Brief description of dialogue/action in this segment"
        }
      ],
      "startTime": "00:11.00",
      "endTime": "00:43.90",
      "hook": "Quote the exact opening line/action in the first 3s and explain why it stops the scroll.",
      "cliffhanger": "Quote the exact final line/action where the clip cuts and what question is left unanswered.",
      "whyItWorks": "One crisp sentence explaining why this pulls new viewers in.",
      "postingStrategy": "Why post this first/second and which platform (Reels/TikTok/Shorts) suits it best.",
      "viralScore": 94,
      "qualityWarning": "Specific critique of where this pick might underperform (e.g., slow pacing, dialogue-heavy, or mild emotional stakes)."
    }
  ],
  "episodeFailureAnalysis": "Honest 2-sentence evaluation of where this episode struggles for promo extraction (e.g., quiet bonding episode with low conflict, or requires heavy backstory)."
}`;

            const userPrompt = `Episode: ${metadata.episodeTitle}
Logline: ${metadata.logline}
Total Episode Duration: ~${metadata.totalDurationSeconds} seconds

Screenplay Content:
${scriptContent}`;

            let aiResponseText = null;
            let lastError = null;

            // Execute with Automatic Model Fallback
            for (const candidateModel of modelQueue) {
                try {
                    const completion = await groq.chat.completions.create({
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        model: candidateModel,
                        temperature: 0.2,
                        response_format: { type: 'json_object' }
                    });

                    aiResponseText = completion.choices[0]?.message?.content;
                    actualModelUsed = candidateModel;

                    if (completion.usage) {
                        totalPromptTokens += completion.usage.prompt_tokens || 0;
                        totalCompletionTokens += completion.usage.completion_tokens || 0;
                    }
                    break;
                } catch (err) {
                    console.warn(`[Auto-Fallback] Model ${candidateModel} failed or timed out (${err.message}). Switching to next model...`);
                    lastError = err;
                }
            }

            if (!aiResponseText) {
                throw new Error(`All configured models failed. Last error: ${lastError?.message}`);
            }

            const parsedData = JSON.parse(aiResponseText);
            const rawPromos = parsedData.promos || [];

            // Deterministic Code Post-Processing: Sum segments accurately
            const verifiedPromos = rawPromos.map((promo) => {
                let totalCalcSec = 0;
                const processedSegments = (promo.segments && promo.segments.length > 0)
                    ? promo.segments.map((seg, idx) => {
                        const s = timestampToSeconds(seg.startTime);
                        const e = timestampToSeconds(seg.endTime);
                        const dur = e > s ? Math.round(e - s) : 15;
                        totalCalcSec += dur;
                        return {
                            segmentOrder: idx + 1,
                            startTime: seg.startTime,
                            endTime: seg.endTime,
                            durationSeconds: dur,
                            whatHappens: seg.whatHappens || ''
                        };
                    })
                    : [{
                        segmentOrder: 1,
                        startTime: promo.startTime,
                        endTime: promo.endTime,
                        durationSeconds: Math.max(1, Math.round(timestampToSeconds(promo.endTime) - timestampToSeconds(promo.startTime))),
                        whatHappens: 'Continuous sequence'
                    }];

                if (totalCalcSec === 0) {
                    const s = timestampToSeconds(promo.startTime);
                    const e = timestampToSeconds(promo.endTime);
                    totalCalcSec = e > s ? Math.round(e - s) : 30;
                }

                const isDurationValid = totalCalcSec >= 20 && totalCalcSec <= 60;
                let ruleFlag = `PASS (${totalCalcSec}s is within 20s-60s target)`;
                if (totalCalcSec < 20) ruleFlag = `FLAGGED: Too Short (${totalCalcSec}s < 20s min)`;
                if (totalCalcSec > 60) ruleFlag = `FLAGGED: Too Long (${totalCalcSec}s > 60s max)`;

                return {
                    ...promo,
                    episodeName: metadata.episodeTitle,
                    fileName: file.originalname,
                    segments: processedSegments,
                    calculatedDurationSeconds: totalCalcSec,
                    isDurationValid,
                    ruleValidationFlag: ruleFlag
                };
            });

            allExtractedPromos.push(...verifiedPromos);

            episodeResults.push({
                fileName: file.originalname,
                metadata,
                episodeFailureAnalysis: parsedData.episodeFailureAnalysis || 'No structural failures noted.',
                promosCount: verifiedPromos.length,
                promos: verifiedPromos
            });

            // Small 300ms breather between files during large batch runs to respect rate limits
            if (files.length > 3) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        // Global Ranking across all uploaded episodes by viralScore
        allExtractedPromos.sort((a, b) => (b.viralScore || 0) - (a.viralScore || 0));
        allExtractedPromos = allExtractedPromos.map((p, idx) => ({
            ...p,
            globalRank: idx + 1
        }));

        // Accurate Cost Calculation based on the actual model used
        const pricing = MODEL_PRICING[actualModelUsed] || MODEL_PRICING['openai/gpt-oss-20b'];
        const estimatedCostUSD = ((totalPromptTokens / 1_000_000) * pricing.input) + ((totalCompletionTokens / 1_000_000) * pricing.output);

        res.status(200).json({
            status: 'success',
            summary: {
                totalEpisodesProcessed: files.length,
                totalPromosExtracted: allExtractedPromos.length,
                modelUsed: actualModelUsed,
                tokensUsed: {
                    prompt: totalPromptTokens,
                    completion: totalCompletionTokens,
                    total: totalPromptTokens + totalCompletionTokens
                },
                estimatedRunCostUSD: `$${estimatedCostUSD.toFixed(5)}`,
                projected50EpisodeShowCostUSD: `$${((estimatedCostUSD / files.length) * 50).toFixed(4)}`
            },
            globalRankedPromos: allExtractedPromos,
            episodeBreakdown: episodeResults
        });

    } catch (error) {
        console.error('Error processing scripts:', error);
        res.status(500).json({ 
            error: error.message || 'An internal server error occurred while analyzing the scripts.' 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Backend Server is running on port ${PORT} | Primary Model (.env): ${ENV_MODELS[0]}`);
});