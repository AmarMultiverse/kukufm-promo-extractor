import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import Groq from 'groq-sdk';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Groq Client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Configure Multer for file uploads (temporary storage in memory)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Health Check Endpoint
 */
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Server is running optimally.' });
});

/**
 * Extract Promos Endpoint
 * Accepts a text file, parses it, and sends it to Groq AI for promo extraction.
 */
app.post('/api/extract-promos', upload.single('scriptFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No script file provided.' });
        }

        // Convert the uploaded file buffer to a UTF-8 string
        const scriptContent = req.file.buffer.toString('utf-8');

        // Professional Prompt Engineering for KukuFM Requirements
        const prompt = `
        You are an expert microdrama film editor. Your task is to analyze the following screenplay and extract the best promotional clips (promos).
        
        Requirements for each promo:
        1. Duration: Between 20 to 60 seconds (calculate using the provided Start and End timestamps in the script).
        2. Hook: Must open on a strong hook in the first 3 seconds (e.g., a slap, a reveal, a shocking line).
        3. Cliffhanger: Must end at an unresolved, suspenseful moment.
        4. Standalone: Must make sense to a new viewer who has never seen the show.
        5. Rank them from best to worst based on promotional value.
        
        You MUST return the output STRICTLY as a JSON object containing a "promos" array. 
        Each promo object in the array must strictly have these exact keys:
        - "rank": (Number) Rank of the promo (1 being the best).
        - "startTime": (String) Exact start timestamp (e.g., "00:15.50").
        - "endTime": (String) Exact end timestamp (e.g., "01:05.20").
        - "hook": (String) Describe the hook in one short sentence.
        - "cliffhanger": (String) Describe the cliffhanger in one short sentence.
        - "whyItWorks": (String) One sentence explaining why this clip will pull a scrolling viewer in.
        
        Do NOT include any markdown formatting like \`\`\`json. Return only the raw JSON object.
        
        Screenplay Content:
        ${scriptContent}
        `;

        // Call Groq API using a fast and capable model
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.2, // Low temperature for factual, analytical extraction
            response_format: { type: "json_object" } // Enforces JSON output format
        });

        // Extract and parse the AI response
        const aiResponse = completion.choices[0]?.message?.content;
        
        if (!aiResponse) {
            throw new Error("AI returned an empty response.");
        }

        const parsedResponse = JSON.parse(aiResponse);

        // Send the parsed JSON promos back to the frontend
        res.status(200).json({
            status: 'success',
            data: parsedResponse
        });

    } catch (error) {
        console.error('Error processing script:', error);
        res.status(500).json({ error: 'An internal server error occurred while analyzing the script.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Backend Server is successfully running on port ${PORT}`);
});