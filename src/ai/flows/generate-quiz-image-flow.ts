'use server';
/**
 * @fileOverview This file defines a Genkit flow that generates an image for a quiz question.
 *
 * - generateQuizImage - A function that generates an image based on a text hint.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateQuizImageInputSchema = z.object({
  imageHint: z.string().describe('A two-word hint to generate an image.'),
});
export type GenerateQuizImageInput = z.infer<typeof GenerateQuizImageInputSchema>;

const GenerateQuizImageOutputSchema = z.object({
  imageUrl: z.string().describe("The generated image as a data URI. Expected format: 'data:image/png;base64,<encoded_data>'."),
});
export type GenerateQuizImageOutput = z.infer<typeof GenerateQuizImageOutputSchema>;

export async function generateQuizImage(input: GenerateQuizImageInput): Promise<GenerateQuizImageOutput> {
  return generateQuizImageFlow(input);
}

const generateQuizImageFlow = ai.defineFlow(
  {
    name: 'generateQuizImageFlow',
    inputSchema: GenerateQuizImageInputSchema,
    outputSchema: GenerateQuizImageOutputSchema,
  },
  async ({imageHint}) => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `A vibrant, high-quality, photorealistic image for a quiz game, representing the concept: ${imageHint}. The image should be visually appealing and clear. No text or logos.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media || !media.url) {
      throw new Error('Image generation failed.');
    }
    
    return { imageUrl: media.url };
  }
);
