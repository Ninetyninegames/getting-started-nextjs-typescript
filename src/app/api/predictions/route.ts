import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'; // AWS SDK v3 for S3
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Replicate from 'replicate';
import { v4 as uuidv4 } from 'uuid';

// Initialize AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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

    // Log the entire formData for debugging purposes
    console.log('Received formData:');
    formData.forEach((value, key) => {
      console.log(`${key}:`, value);
    });

    const modelType = formData.get('model_type') as string;
    console.log('Model Type:', modelType); // Check if the model_type is correctly received

    let prediction;

    if (modelType === 'generate_obj_texture') {
      // Handle OBJ texture generation

      const prompt = formData.get('prompt') as string;
      const shapePath = formData.get('shape_path') as File;
      console.log('Shape Path:', shapePath);

      if (!shapePath) {
        console.error('No shape_path provided');
        return NextResponse.json({ error: 'No shape_path provided' }, { status: 400 });
      }

      // Log the shape_path file details
      console.log('Shape Path Details - Name:', shapePath.name, 'Size:', shapePath.size);

      const arrayBuffer = await shapePath.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to S3
      const fileName = `${uuidv4()}-${shapePath.name}`;
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME, // Ensure this environment variable is set
        Key: fileName,
        Body: buffer,
        ContentType: shapePath.type,
      };

      const uploadCommand = new PutObjectCommand(uploadParams);
      await s3Client.send(uploadCommand);

      // Get the signed URL for the uploaded file
      const signedUrl = await getSignedUrl(s3Client, uploadCommand, { expiresIn: 3600 });

      // Input for Replicate API
      const input = {
        prompt,
        shape_path: signedUrl,
        shape_scale: formData.get('shape_scale') || '0.6',
        texture_resolution: formData.get('texture_resolution') || '1024',
        guidance_scale: formData.get('guidance_scale') || '10',
        texture_interpolation_mode: formData.get('texture_interpolation_mode') || 'bilinear',
        seed: formData.get('seed') || '0',
      };

      console.log('Input for OBJ texture generation:', input);

      prediction = await replicate.predictions.create({
        version: '456e72c47358d0da0a1b3002c8cf9f4eb123afa4bb8ff2b521fea40a71746a7f', // Your OBJ texture model version
        input,
      });

    } else if (modelType === 'ply') {
      // Handle PLY model creation

      const prompt = formData.get('ply_prompt') as string;

      // Log the prompt for PLY model
      console.log('PLY Prompt:', prompt);

      // Input for PLY model prediction
      const input = {
        prompt,
        guidance_scale: formData.get('guidance_scale') || '10',
        max_steps: formData.get('max_steps') || '500',
      };

      console.log('Input for PLY model:', input);

      prediction = await replicate.predictions.create({
        version: '138abc0aed076d5a1d3c17c5f157e9092e6279c8c1d7d92f1618dc7f707290a4', // GaussianDreamer version
        input,
      });

    } else {
      // Handle invalid model type
      console.error('Invalid model type:', modelType);
      return NextResponse.json({ error: 'Invalid model type' }, { status: 400 });
    }

    if (prediction?.error) {
      console.error('Prediction error:', prediction.error);
      return NextResponse.json({ detail: prediction.error.message }, { status: 500 });
    }

    console.log('Prediction success:', prediction);
    return NextResponse.json(prediction, { status: 201 });

  } catch (error) {
    console.error('Unexpected error occurred:', error);
    return NextResponse.json({ detail: 'An unexpected error occurred during prediction creation.' }, { status: 500 });
  }
}
