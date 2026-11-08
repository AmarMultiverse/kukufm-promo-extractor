import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import Groq from 'groq-sdk';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Groq Client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Configure Multer for multiple file uploads in memory
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Priority list of active production models from Groq Documentation
const FALLBACK_MODELS = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b'
];

/**
 * Helper Function: Rule-Based Script Pre-Parser
 * Extracts deterministic metadata using Regex before sending to LLM.
 */
function parseScriptMetadata(scriptText, fileName) {
    const episodeMatch = scriptText.match(/EPISODE NUMBER:\s*(.+)/i);
    const loglineMatch = scriptText.match(/EPISODE LOGLINE:\s*(.+)/i);
    
    // Extract all timestamps in format (MM:SS.ms) or MM:SS.ms
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
        totalDurationSeconds: Math.round(maxEndSeconds),
        totalTimestampedBeats: totalSegments
    };
}

/**
 * Helper Function: Convert MM:SS.ms to Seconds for Rule Validation
 */
function timestampToSeconds(ts) {
    if (!ts || typeof ts !== 'string') return 0;
    const cleanTs = ts.replace(/[()]/g, '').trim();
    const parts = cleanTs.split(':');
    if (parts.length !== 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
}

/**
 * GET /api/models
 * Dynamically fetches active models from Groq API so the app never breaks on deprecations.
 */
app.get('/api/models', async (req, res) => {
    try {
        const response = await groq.models.list();
        const availableModels = response.data
            .map(m => m.id)
            .filter(id => !id.includes('whisper') && !id.includes('guard') && !id.includes('orpheus'));
        
        res.status(200).json({
            status: 'success',
            recommended: FALLBACK_MODELS,
            allActiveModels: availableModels
        });
    } catch (error) {
        console.error('Error fetching models:', error.message);
        res.status(200).json({
            status: 'fallback',
            recommended: FALLBACK_MODELS,
            allActiveModels: FALLBACK_MODELS
        });
    }
});

/**
 * POST /api/extract-promos
 * Processes single or multiple screenplay files with Auto-Fallback LLM execution and Rule Validation.
 */
app.post('/api/extract-promos', upload.array('scriptFiles', 55), async (req, res) => {
    try {
        const files = req.files;
        const preferredModel = req.body.model || 'openai/gpt-oss-120b';

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No script files provided. Please upload at least one .txt file.' });
        }

        const modelQueue = [
            preferredModel,
            ...FALLBACK_MODELS.filter(m => m !== preferredModel)
        ];

        const episodeResults = [];
        let allExtractedPromos = [];
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        let actualModelUsed = preferredModel;

        // Process each uploaded episode script
        for (const file of files) {
            const scriptContent = file.buffer.toString('utf-8');
            const metadata = parseScriptMetadata(scriptContent, file.originalname);

            const systemPrompt = `You are a Principal Short-Form Video Editor & Growth Strategist at a vertical microdrama platform (like Kuku TV, ReelShort, DramaBox).
Your job is to read a timestamped episode screenplay and find the highest-converting promotional clips (promos) for Instagram Reels, TikTok, and YouTube Shorts.

STRICT PROMO RULES:
1. Duration: Each promo MUST be between 20 and 60 seconds total. It can be a single continuous stretch OR 2-3 stitched segments from the episode.
2. The 3-Second Hook: Must open on an immediate visual/verbal hook in the first 3 seconds (betrayal, slap, power reversal, shocking accusation, emotional breakdown, or physical confrontation).
3. The Cliffhanger Cut: Must cut at maximum unresolved tension so the viewer is forced to download the app to see what happens next.
4. Standalone Clarity: A cold viewer scrolling their feed with zero prior context must immediately understand the stakes and conflict.
5. Honest Self-Critique (Quality Check): Critically evaluate where your pick might fail or feel weak (e.g., relies on dialogue over visual action, abrupt cut, or slightly melodramatic).

Return STRICTLY a valid JSON object matching this exact schema:
{
  "promos": [
    {
      "promoTitle": "Short punchy title for the ad creative",
      "isMultiSegment": false,
      "segments": [
        { "startTime": "00:11.00", "endTime": "00:43.90", "durationSeconds": 33 }
      ],
      "startTime": "00:11.00",
      "endTime": "00:43.90",
      "totalDurationSeconds": 33,
      "hook": "Exact line or visual action in the first 3 seconds that stops the scroll.",
      "cliffhanger": "Exact unresolved moment where the clip cuts to black.",
      "whyItWorks": "One crisp sentence explaining the psychological trigger (e.g., public humiliation, status reversal, justice desire).",
      "viralScore": 92,
      "qualityWarning": "Honest critique of where this clip might underperform or why an editor might reject it."
    }
  ],
  "episodeFailureAnalysis": "One honest paragraph explaining where the automated tool struggled in this specific script (e.g., slow conversational pacing, lack of physical hooks, or heavy reliance on prior episode continuity)."
}`;

            const userPrompt = `Episode Name: ${metadata.episodeTitle}
Logline: ${metadata.logline}
Total Episode Duration: ~${metadata.totalDurationSeconds} seconds

Screenplay Content:
${scriptContent}`;

            let aiResponseText = null;
            let lastError = null;

            // Auto-Fallback Execution Loop across models
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
                    break; // Success! Exit fallback loop
                } catch (err) {
                    console.warn(`Model ${candidateModel} failed (${err.message}). Trying next fallback model...`);
                    lastError = err;
                }
            }

            if (!aiResponseText) {
                throw new Error(`All models failed. Last error: ${lastError?.message}`);
            }

            const parsedData = JSON.parse(aiResponseText);
            const rawPromos = parsedData.promos || [];

            // Deterministic Code Post-Processing & Rule Verification
            const verifiedPromos = rawPromos.map((promo) => {
                const startSec = timestampToSeconds(promo.startTime);
                const endSec = timestampToSeconds(promo.endTime);
                const calcDuration = endSec > startSec ? Math.round(endSec - startSec) : (promo.totalDurationSeconds || 30);
                
                // Rule Check: Is duration strictly within 20s - 60s?
                const isDurationValid = calcDuration >= 20 && calcDuration <= 60;
                let ruleFlag = 'PASS (Optimal 20s-60s Window)';
                if (calcDuration < 20) ruleFlag = `WARNING: Short Clip (${calcDuration}s < 20s min)`;
                if (calcDuration > 60) ruleFlag = `WARNING: Long Clip (${calcDuration}s > 60s max)`;

                return {
                    ...promo,
                    episodeName: metadata.episodeTitle,
                    fileName: file.originalname,
                    calculatedDurationSeconds: calcDuration,
                    isDurationValid,
                    ruleValidationFlag: ruleFlag
                };
            });

            allExtractedPromos.push(...verifiedPromos);

            episodeResults.push({
                fileName: file.originalname,
                metadata,
                episodeFailureAnalysis: parsedData.episodeFailureAnalysis || 'No specific structural failures detected.',
                promosCount: verifiedPromos.length,
                promos: verifiedPromos
            });
        }

        // Global Ranking across all uploaded episodes by viralScore
        allExtractedPromos.sort((a, b) => (b.viralScore || 0) - (a.viralScore || 0));
        allExtractedPromos = allExtractedPromos.map((p, idx) => ({
            ...p,
            globalRank: idx + 1
        }));

        // Calculate Real-World Scale Cost (based on GPT-OSS-120B pricing: $0.15/1M input, $0.60/1M output)
        const estimatedCostUSD = ((totalPromptTokens / 1_000_000) * 0.15) + ((totalCompletionTokens / 1_000_000) * 0.60);

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
    console.log(`Backend Server is successfully running on port ${PORT}`);
});