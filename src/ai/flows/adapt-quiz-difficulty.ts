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
  correctAnswersCount: z
    .number()
    .describe('The number of questions the user has answered correctly.'),
  totalQuestions: z
    .number()
    .describe('The total number of questions in the quiz.'),
  questionsAnswered: z
    .number()
    .describe('The number of questions the user has answered so far.'),
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
  prompt: `You are an AI algorithm for a quiz game, designed to dynamically adjust question difficulty. Analyze the user's performance and determine the optimal difficulty for the next question.

Performance Data:
- Correct Answers: {{{correctAnswersCount}}}
- Total Questions in Quiz: {{{totalQuestions}}}
- Questions Answered So Far: {{{questionsAnswered}}}

Your task is to output a new difficulty ('easy', 'medium', or 'hard') and the reasoning for your decision based on this algorithm:
1.  If no questions have been answered yet, this is not applicable.
2.  Calculate the user's current accuracy percentage: (correctAnswersCount / questionsAnswered).
3.  If accuracy is below 40%, the user is struggling. Recommend 'easy'.
4.  If accuracy is between 40% and 75%, the user is performing adequately. Recommend 'medium'.
5.  If accuracy is above 75%, the user is excelling. Recommend 'hard'.
6.  If it's early in the quiz (less than 3 questions answered), be more conservative with difficulty increases.
7.  Provide a brief, encouraging reasoning for your choice in Brazilian Portuguese. For example: "Você está indo muito bem! Vamos aumentar um pouco o desafio." or "Vamos tentar uma um pouco mais fácil para pegar o ritmo."

Based on your analysis, provide the new difficulty and reasoning.`,
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
