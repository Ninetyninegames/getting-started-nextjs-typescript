import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(request: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });
  }

  try {
    const formData = await request.formData();

    const modelType = formData.get('model_type') as string;

    let prediction;

    if (modelType === 'dynamic_glb') {
      const prompt = formData.get('prompt') as string;
      const useFastConfigs = formData.get('use_fast_configs') === 'on';
      const guidanceScaleValue = formData.get('guidance_scale');
      const guidanceScale = guidanceScaleValue ? parseFloat(guidanceScaleValue.toString()) : undefined;
      const numStepsValue = formData.get('num_steps');
      const numSteps = numStepsValue ? parseInt(numStepsValue.toString()) : undefined;
      const seedValue = formData.get('seed');
      const seed = seedValue ? parseInt(seedValue.toString()) : undefined;
      const imageType = formData.get('image_type') as string;

      let imageUrl: string | undefined;

      if (imageType === 'url') {
        imageUrl = formData.get('image_url') as string;
      } else if (imageType === 'upload') {
        const file = formData.get('image');

        if (!file || typeof file === 'string') {
          return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
        }

        // Read the file content
        const arrayBuffer = await (file as File).arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Create a FormData to upload the file
        const uploadFormData = new FormData();
        uploadFormData.append('file', new Blob([buffer], { type: file.type }), (file as File).name);

        // Upload the file
        const uploadResponse = await fetch('https://replicate.com/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('Error uploading image:', errorText);
          return NextResponse.json({ error: 'Error uploading image' }, { status: 500 });
        }

        const uploadResult = await uploadResponse.json();
        imageUrl = uploadResult.url;
      }

      // Build the input object dynamically
      const input: any = {
        prompt,
        image: imageUrl,
      };

      if (useFastConfigs) {
        input.use_fast_configs = useFastConfigs;
      }
      if (guidanceScale !== undefined) {
        input.guidance_scale = guidanceScale;
      }
      if (numSteps !== undefined) {
        input.num_steps = numSteps;
      }
      if (seed !== undefined) {
        input.seed = seed;
      }

      prediction = await replicate.predictions.create({
        version: 'your_dynamic_glb_model_version_id', // Replace with your actual model version ID
        input,
      });

    } else if (modelType === 'ply') {
      const prompt = formData.get('prompt') as string;
      const negativePromptValue = formData.get('negative_prompt');
      const negativePrompt = negativePromptValue ? negativePromptValue.toString() : undefined;
      const guidanceScaleValue = formData.get('guidance_scale');
      const guidanceScale = guidanceScaleValue ? parseFloat(guidanceScaleValue.toString()) : undefined;
      const maxStepsValue = formData.get('max_steps');
      const maxSteps = maxStepsValue ? parseInt(maxStepsValue.toString()) : undefined;
      const avatar = formData.get('avatar') === 'on';
      const seedValue = formData.get('seed');
      const seed = seedValue ? parseInt(seedValue.toString()) : undefined;

      // Build the input object dynamically
      const input: any = {
        prompt,
      };

      if (negativePrompt !== undefined && negativePrompt !== '') {
        input.negative_prompt = negativePrompt;
      }
      if (guidanceScale !== undefined) {
        input.guidance_scale = guidanceScale;
      }
      if (maxSteps !== undefined) {
        input.max_steps = maxSteps;
      }
      if (avatar) {
        input.avatar = avatar;
      }
      if (seed !== undefined) {
        input.seed = seed;
      }

      prediction = await replicate.predictions.create({
        version: '138abc0aed076d5a1d3c17c5f157e9092e6279c8c1d7d92f1618dc7f707290a4', // GaussianDreamer version
        input,
      });

    } else {
      return NextResponse.json({ error: 'Invalid model type' }, { status: 400 });
    }

    if (prediction?.error) {
      console.error('Prediction error:', prediction.error);
      return NextResponse.json({ detail: prediction.error.message }, { status: 500 });
    }

    return NextResponse.json(prediction, { status: 201 });

  } catch (error) {
    console.error('Unexpected error occurred:', error);
    return NextResponse.json({ detail: 'An unexpected error occurred during prediction creation.' }, { status: 500 });
  }
}
