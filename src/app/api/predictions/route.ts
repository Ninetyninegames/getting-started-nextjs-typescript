import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3'; // AWS SDK v3 for S3
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Replicate from 'replicate';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip'; // Ensure you have the adm-zip package installed

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
    const imagePath = formData.get('image_path') as File | string; // Can be a file or a URL
    const isFileUpload = typeof imagePath !== 'string'; // Check if the imagePath is a file or a URL

    console.log('Model Type:', modelType);

    let prediction;
    let signedUrl: string;

    if (isFileUpload) {
      // Handle File Upload: The image is a file object
      const file = imagePath as File;

      if (!file) {
        console.error('No image_path provided');
        return NextResponse.json({ error: 'No image_path provided' }, { status: 400 });
      }

      // Log the image file details
      console.log('Image File Details - Name:', file.name, 'Size:', file.size);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to S3
      const fileName = `${uuidv4()}-${file.name}`;
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME, // Ensure this environment variable is set
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
        ACL: 'public-read' as ObjectCannedACL, // Ensure the correct ACL type
      };

      const uploadCommand = new PutObjectCommand(uploadParams);
      await s3Client.send(uploadCommand);

      // Get the signed URL for the uploaded image file
      signedUrl = await getSignedUrl(s3Client, uploadCommand, { expiresIn: 3600 });
    } else {
      // Handle URL: The imagePath is already a URL
      signedUrl = imagePath as string;
    }

    // Now proceed to Replicate API (for either URL or uploaded file)
    const input = {
      image_path: signedUrl,
      remove_background: formData.get('remove_background') === 'true',
      export_video: formData.get('export_video') === 'true',
      export_texmap: formData.get('export_texmap') === 'true',
      sample_steps: parseInt(formData.get('sample_steps') as string) || 75,
      seed: parseInt(formData.get('seed') as string) || 42,
    };

    console.log('Input for GLB mesh generation:', input);

    if (modelType === 'generate_glb_mesh') {
      // Call the Replicate API for generating GLB mesh
      prediction = await replicate.predictions.create({
        version: 'e353a25cc764e0edb0aa9033df0bf4b82318dcda6d0a0cd9f2aace90566068ac', // GLB Mesh model version
        input,
      });
    } else if (modelType === 'ply') {
      // Handle PLY model creation (for completeness)
      const prompt = formData.get('ply_prompt') as string;

      const input = {
        prompt,
        guidance_scale: parseFloat(formData.get('guidance_scale') as string) || 10,
        max_steps: parseInt(formData.get('max_steps') as string) || 500,
      };

      console.log('Input for PLY model:', input);

      prediction = await replicate.predictions.create({
        version: '138abc0aed076d5a1d3c17c5f157e9092e6279c8c1d7d92f1618dc7f707290a4', // PLY model version
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
