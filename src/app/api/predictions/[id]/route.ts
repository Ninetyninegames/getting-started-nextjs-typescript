// src/app/api/predictions/[id]/route.ts

import Replicate from "replicate";

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// GET handler to fetch the prediction by ID
export async function GET(
  req: Request,
  { params }: { params: { id: string | string[] } }
) {
  let { id } = params;

  // Handle the possibility of id being an array
  if (Array.isArray(id)) {
    id = id[0]; // Use the first id in the array
  }

  try {
    // Fetch the prediction using the provided id from Replicate
    const prediction = await replicate.predictions.get(id);

    // Check if the prediction exists or has an error
    if (!prediction || prediction.error) {
      console.error(
        "Prediction error:",
        prediction?.error?.detail || "No prediction found"
      );
      return new Response(
        JSON.stringify({
          detail: prediction?.error?.detail || "Prediction not found",
        }),
        { status: 404 }
      );
    }

    // If the prediction exists and is successful, return it
    return new Response(JSON.stringify(prediction), { status: 200 });
  } catch (err) {
    console.error("Error fetching prediction:", err);
    return new Response(
      JSON.stringify({
        detail: "An error occurred while fetching the prediction.",
      }),
      { status: 500 }
    );
  }
}
