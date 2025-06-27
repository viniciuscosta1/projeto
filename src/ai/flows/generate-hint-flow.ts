'use server';

/**
 * @fileOverview This file defines a Genkit flow that generates a hint for a quiz question.
 *
 * - generateHint - A function that provides a hint for a given question.
 * - GenerateHintInput - The input type for the generateHint function.
 * - GenerateHintOutput - The return type for the generateHint function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateHintInputSchema = z.object({
  question: z.string().describe('The quiz question text.'),
  options: z.array(z.string()).describe('The multiple-choice options for the question.'),
  answer: z.string().describe('The correct answer to the question.'),
});
export type GenerateHintInput = z.infer<typeof GenerateHintInputSchema>;

const GenerateHintOutputSchema = z.object({
  hint: z.string().describe('A subtle hint for the quiz question, in Brazilian Portuguese.'),
});
export type GenerateHintOutput = z.infer<typeof GenerateHintOutputSchema>;

export async function generateHint(input: GenerateHintInput): Promise<GenerateHintOutput> {
  return generateHintFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateHintPrompt',
  input: {schema: GenerateHintInputSchema},
  output: {schema: GenerateHintOutputSchema},
  prompt: `You are a helpful quiz assistant. Your goal is to provide a single, subtle hint in Brazilian Portuguese for the following quiz question to help a user who is stuck.

**CRITICAL RULE:** Do NOT reveal the answer directly or mention any of the options by name. The hint should guide the user to the correct answer, not give it away.

Question: "{{{question}}}"
Options: {{#each options}}- {{{this}}}\n{{/each}}
Correct Answer: "{{{answer}}}"

Based on this, generate a creative and subtle hint. For example, if the question is about the Eiffel Tower, a good hint would be "Pense no monumento de ferro mais famoso de Paris." and a bad hint would be "A resposta começa com 'Eiffel...'".

Generate the hint now.`,
});

const generateHintFlow = ai.defineFlow(
  {
    name: 'generateHintFlow',
    inputSchema: GenerateHintInputSchema,
    outputSchema: GenerateHintOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
