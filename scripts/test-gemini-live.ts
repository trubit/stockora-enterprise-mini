import 'dotenv/config';
import mongoose from 'mongoose';
import { geminiService } from '../src/server/services/ai/gemini/gemini.service.js';
import { getGeminiServerConfig } from '../src/server/services/ai/gemini/gemini.config.js';
import { AIUsageLog } from '../src/server/models/AIUsageLog.js';

async function runLiveVerification() {
  console.log('====================================================');
  console.log('STOCKORA ENTERPRISE — GEMINI LIVE INTEGRATION TEST');
  console.log('====================================================');

  const config = getGeminiServerConfig();
  console.log('Provider: Google Gemini REST API');
  console.log(`Configured Model: ${config.model}`);
  console.log(`Gemini Enabled: ${config.enabled}`);
  console.log(`API Key configured: ${config.apiKey ? 'YES (Length: ' + config.apiKey.length + ', Prefix: ' + config.apiKey.substring(0, 6) + '...)' : 'NO'}`);

  // Attempt DB connection if MONGO_URI available
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/stockora';
  let dbConnected = false;
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    dbConnected = true;
    console.log('MongoDB Connected: YES (Usage logs will be verified in DB)');
  } catch (err: any) {
    console.log(`MongoDB Connected: NO (${err.message}). Continuing with API test...`);
  }

  console.log('\n--- Sending live test prompt to Google Gemini API ---');
  const startTime = Date.now();
  try {
    const rawRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`);
    console.log(`\nGoogle API raw models list HTTP status: ${rawRes.status}`);
    const rawData = await rawRes.json() as any;
    console.log('Available models for this API key:');
    (rawData.models || []).forEach((m: any) => {
      console.log(` - ${m.name} (${m.displayName}) - methods: [${(m.supportedGenerationMethods || []).join(', ')}]`);
    });
  } catch (e: any) {
    console.log(`Raw test error: ${e.message}`);
  }

  try {
    const result = await geminiService.generateContent({
      tenantId: 'tenant-live-verify',
      userId: 'admin-live-tester',
      action: 'live_verification',
      prompt: 'Respond with exactly the text: "STOCKORA_GEMINI_LIVE_OK" and nothing else.',
      temperature: 0.1,
      maxTokens: 50,
      timeoutMs: 15000,
    });

    console.log('\n>>> LIVE GEMINI API CALL SUCCEEDED! <<<');
    console.log(`Latency: ${result.latencyMs}ms (Total roundtrip: ${Date.now() - startTime}ms)`);
    console.log(`Model Used: ${result.model}`);
    console.log(`Tokens - Prompt: ${result.usage.promptTokens}, Completion: ${result.usage.completionTokens}, Total: ${result.usage.totalTokens}`);
    console.log(`Estimated Cost: $${result.usage.estimatedCost.toFixed(6)}`);
    console.log(`Response Content: ${result.content.trim()}`);

    if (dbConnected) {
      const recentLog = await AIUsageLog.findOne({ tenantId: 'tenant-live-verify' }).sort({ createdAt: -1 });
      if (recentLog) {
        console.log(`\nVerified DB Usage Log: ID=${recentLog._id}, Status=${recentLog.status}, Cost=$${recentLog.estimatedCost.toFixed(6)}, Tokens=${recentLog.totalTokens}`);
      }
    }
    console.log('\nResult: LIVE_API_SUCCESS');
  } catch (err: any) {
    console.log('\n>>> LIVE GEMINI API CALL FAILED / RETURNED ERROR <<<');
    console.log(`Error Name: ${err.name}`);
    console.log(`Error Code: ${err.code || 'N/A'}`);
    console.log(`HTTP Status: ${err.statusCode || 'N/A'}`);
    console.log(`Error Message: ${err.message}`);

    if (err.code === 'AI_QUOTA_EXCEEDED' || err.statusCode === 429) {
      console.log('\nClassification: [AI_QUOTA_EXCEEDED]');
      console.log('Diagnosis: The Google Gemini API returned HTTP 429 RESOURCE_EXHAUSTED / quota exceeded for this API key/project.');
      console.log('The Stockora Gemini client properly detected, handled, and classified this without crash or infinite loops.');
    } else if (err.code === 'AI_INVALID_AUTH' || err.statusCode === 400 || err.statusCode === 401 || err.statusCode === 403) {
      console.log('\nClassification: [AUTHENTICATION/PERMISSION ISSUE]');
      console.log(`Diagnosis: Google rejected the key or project configuration (${err.message}).`);
    }

    if (dbConnected) {
      const recentLog = await AIUsageLog.findOne({ tenantId: 'tenant-live-verify' }).sort({ createdAt: -1 });
      if (recentLog) {
        console.log(`\nVerified DB Usage Log recorded failure: ID=${recentLog._id}, Status=${recentLog.status}, Error=${recentLog.errorMessage}`);
      }
    }
    console.log('\nResult: LIVE_API_ERROR_CAPTURED');
  } finally {
    if (dbConnected) {
      await mongoose.disconnect();
    }
  }
}

runLiveVerification().catch(console.error);
