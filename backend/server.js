import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
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

// Configure Multer for file uploads (temporary storage in memory for fast processing)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Health Check Endpoint
 * Verifies that the server is running correctly.
 */
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Server is running optimally.' });
});

/**
 * Extract Promos Endpoint
 * Accepts a text file (script), parses it, and sends it to the AI for promo extraction.
 */
app.post('/api/extract-promos', upload.single('scriptFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No script file provided.' });
        }

        // Convert the uploaded file buffer to a UTF-8 string
        const scriptContent = req.file.buffer.toString('utf-8');

        // TODO: In the next step, we will add the Groq LLM prompt logic here
        // to identify hooks and cliffhangers from the scriptContent.

        res.status(200).json({
            status: 'success',
            message: 'File received successfully. AI processing logic pending.',
            receivedBytes: req.file.size
        });

    } catch (error) {
        console.error('Error processing script:', error);
        res.status(500).json({ error: 'An internal server error occurred while processing the script.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is successfully running on port ${PORT}`);
});