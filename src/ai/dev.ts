import { config } from 'dotenv';
config();

import '@/ai/flows/adapt-quiz-difficulty.ts';
import '@/ai/flows/translate-text-flow.ts';
import '@/ai/flows/generate-quiz-question-flow.ts';
import '@/ai/flows/generate-quiz-image-flow.ts';
import '@/ai/flows/generate-hint-flow.ts';
