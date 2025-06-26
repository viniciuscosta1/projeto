'use server';

/**
 * @fileOverview This file defines a Genkit flow that adapts quiz difficulty based on user performance.
 *
 * - adaptQuizDifficulty - A function that adjusts the quiz difficulty based on the user's performance.
 * - AdaptQuizDifficultyInput - The input type for the adaptQuizDifficulty function.
 * - AdaptQuizDifficultyOutput - The return type for the adaptQuizDifficulty function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AdaptQuizDifficultyInputSchema = z.object({
  userScore: z
    .number()
    .describe('The current score of the user in the quiz.'),
  totalQuestions: z
    .number()
    .describe('The total number of questions in the quiz.'),
  questionsAnswered: z
    .number()
    .describe('The number of questions the user has answered.'),
});
export type AdaptQuizDifficultyInput = z.infer<
  typeof AdaptQuizDifficultyInputSchema
>;

const AdaptQuizDifficultyOutputSchema = z.object({
  difficultyLevel: z
    .enum(['easy', 'medium', 'hard'])
    .describe(
      'The recommended difficulty level for the next question: easy, medium, or hard.'
    ),
  reasoning: z
    .string()
    .describe(
      'The reasoning behind the difficulty level recommendation based on the user performance.'
    ),
});
export type AdaptQuizDifficultyOutput = z.infer<
  typeof AdaptQuizDifficultyOutputSchema
>;

export async function adaptQuizDifficulty(
  input: AdaptQuizDifficultyInput
): Promise<AdaptQuizDifficultyOutput> {
  return adaptQuizDifficultyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adaptQuizDifficultyPrompt',
  input: {schema: AdaptQuizDifficultyInputSchema},
  output: {schema: AdaptQuizDifficultyOutputSchema},
  prompt: `You are an AI quiz master. You are tasked with dynamically adjusting the difficulty of a quiz based on the user's performance.

User Score: {{{userScore}}}
Total Questions: {{{totalQuestions}}}
Questions Answered: {{{questionsAnswered}}}

Based on the user's score and the number of questions answered, determine whether the next question should be 'easy', 'medium', or 'hard'. Also, include a brief reasoning for your decision.

Consider the following guidelines:
- If the user's score is low relative to the number of questions answered, suggest an easier question.
- If the user's score is high relative to the number of questions answered, suggest a harder question.
- If the user's score is moderate relative to the number of questions answered, suggest a medium difficulty question.

Difficulty Level: {{~difficultyLevel~}}
Reasoning: {{~reasoning~}}`,
});

const adaptQuizDifficultyFlow = ai.defineFlow(
  {
    name: 'adaptQuizDifficultyFlow',
    inputSchema: AdaptQuizDifficultyInputSchema,
    outputSchema: AdaptQuizDifficultyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
