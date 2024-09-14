"use client";

import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import * as THREE from "three";
import { GLTFLoader, GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Prediction {
  id: string;
  status: string;
  output: string[];
  detail?: string;
}

const Your3DViewerComponent = ({ url }: { url: string }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scene = new THREE.Scene();

    const aspectRatio =
      (mountRef.current?.clientWidth || window.innerWidth) /
      (mountRef.current?.clientHeight || window.innerHeight);

    const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      mountRef.current?.clientWidth || window.innerWidth,
      mountRef.current?.clientHeight || window.innerHeight
    );

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const controls = new OrbitControls(camera, renderer.domElement);

    const loadModel = (url: string) => {
      let loader;
      if (url.endsWith(".gltf") || url.endsWith(".glb")) {
        loader = new GLTFLoader();
      } else if (url.endsWith(".ply")) {
        loader = new PLYLoader();
      }

      if (loader) {
        loader.load(
          url,
          (object) => {
            if (url.endsWith(".gltf") || url.endsWith(".glb")) {
              const gltf = object as GLTF;
              scene.add(gltf.scene);
            } else if (url.endsWith(".ply")) {
              const plyGeometry = object as THREE.BufferGeometry;
              const material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                flatShading: true,
              });
              const mesh = new THREE.Mesh(plyGeometry, material);
              scene.add(mesh);
            }
            animate();
          },
          undefined,
          (err) => {
            console.error("An error occurred loading the model:", err);
          }
        );
      }
    };

    loadModel(url);
    camera.position.z = 5;

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    const handleResize = () => {
      if (mountRef.current) {
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [url]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "500px" }} // Adjust the height as needed
    />
  );
};

export default function Home() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelType, setModelType] = useState<string>("dynamic_glb");
  const [imageType, setImageType] = useState<string>("upload");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(`Request failed: ${errorData.error || response.statusText}`);
        setIsLoading(false);
        return;
      }

      const prediction = await response.json();

      if (response.status !== 201) {
        setError(prediction.detail || "Prediction failed");
        setIsLoading(false);
        return;
      }

      setPrediction(prediction);

      // Polling for prediction status
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      while (
        prediction.status !== "succeeded" &&
        prediction.status !== "failed"
      ) {
        await sleep(1000);
        const res = await fetch(`/api/predictions/${prediction.id}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const errorData = await res.json();
          setError(`Request failed: ${errorData.error || res.statusText}`);
          setIsLoading(false);
          return;
        }

        const updatedPrediction = await res.json();
        setPrediction(updatedPrediction);

        if (updatedPrediction.status === "succeeded") {
          setIsLoading(false);
          break;
        }

        if (updatedPrediction.status === "failed") {
          setError("Prediction failed");
          setIsLoading(false);
          break;
        }
      }
    } catch (err) {
      console.error("An unexpected error occurred:", err);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
      <div className="flex flex-col z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex bg-white p-10 border-solid border-2 border-gray-300 rounded-3xl">
        <Head>
          <title>3D Asset Generator</title>
        </Head>

        <p className="mb-4 text-lg text-gray-700">Generate 3D assets:</p>

        {/* Model Type Selection */}
        <select
          value={modelType}
          onChange={(e) => setModelType(e.target.value)}
          className="mb-4 px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="dynamic_glb">Create Dynamic GLB</option>
          <option value="ply">Create Poly</option>
        </select>

        {/* Image Type Selection */}
        {modelType === "dynamic_glb" && (
          <select
            value={imageType}
            onChange={(e) => setImageType(e.target.value)}
            className="mb-4 px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="upload">Upload Image</option>
            <option value="url">Image URL</option>
          </select>
        )}

        {/* Form for user input */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center w-full"
          encType="multipart/form-data"
        >
          <input type="hidden" name="model_type" value={modelType} />
          {modelType === "dynamic_glb" && (
            <input type="hidden" name="image_type" value={imageType} />
          )}

          {/* Prompt (Required for both models) */}
          <input
            type="text"
            name="prompt"
            placeholder="Enter a prompt to generate a 3D asset"
            required
            className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Dynamic GLB Model Fields */}
          {modelType === "dynamic_glb" && (
            <>
              {/* Image Upload or URL (Required) */}
              {imageType === "upload" ? (
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  required
                  className="px-4 py-2 w-full mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <input
                  type="text"
                  name="image_url"
                  placeholder="Enter image URL"
                  required
                  className="px-4 py-2 w-full mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {/* use_fast_configs (Optional Checkbox) */}
              <label className="flex items-center mt-2">
                <input
                  type="checkbox"
                  name="use_fast_configs"
                  className="mr-2"
                />
                Use Fast Configs
              </label>

              {/* guidance_scale (Optional Number) */}
              <input
                type="number"
                name="guidance_scale"
                placeholder="Guidance Scale (optional)"
                step="0.1"
                min="0"
                className="px-4 py-2 w-full mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* num_steps (Optional Integer) */}
              <input
                type="number"
                name="num_steps"
                placeholder="Number of Steps (optional)"
                min="1"
                className="px-4 py-2 w-full mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* seed (Optional Integer) */}
              <input
                type="number"
                name="seed"
                placeholder="Seed (optional)"
                className="px-4 py-2 w-full mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </>
          )}

          {/* Poly (PLY) Model Fields */}
          {modelType === "ply" && (
            <>
              {/* negative_prompt (Optional String) */}
              <input
                type="text"
                name="negative_prompt"
                placeholder="Negative Prompt (optional)"
                className="px-4 py-2 w-full mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* guidance_scale (Optional Number) */}
              <input
                type="number"
                name="guidance_scale"
                placeholder="Guidance Scale (optional)"
                step="0.1"
                min="0"
                className="px-4 py-2 w-full mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* max_steps (Optional Integer) */}
              <input
                type="number"
                name="max_steps"
                placeholder="Max Steps (optional)"
                min="1"
                className="px-4 py-2 w-full mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* avatar (Optional Checkbox) */}
              <label className="flex items-center mt-2">
                <input type="checkbox" name="avatar" className="mr-2" />
                Avatar
              </label>

              {/* seed (Optional Integer) */}
              <input
                type="number"
                name="seed"
                placeholder="Seed (optional)"
                className="px-4 py-2 w-full mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="px-4 py-2 mt-4 w-full bg-blue-500 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            {isLoading
              ? "Generating..."
              : modelType === "ply"
                ? "Generate PLY"
                : "Generate GLB"}
          </button>
        </form>

        {/* Error handling */}
        {error && <div className="mt-4 text-red-500">{error}</div>}

        {/* Loading indicator */}
        {isLoading && !prediction && (
          <div className="mt-4 text-gray-700">Processing your request...</div>
        )}

        {/* Rendering the 3D asset */}
        {prediction && (
          <div className="mt-4 w-full">
            {prediction.output && prediction.output[0] && (
              <div className="flex flex-col items-center justify-center w-full">
                {prediction.output[0].endsWith(".glb") ||
                  prediction.output[0].endsWith(".gltf") ? (
                  <Your3DViewerComponent url={prediction.output[0]} />
                ) : prediction.output[0].endsWith(".ply") ? (
                  <Your3DViewerComponent url={prediction.output[0]} />
                ) : (
                  <p className="text-red-500">Invalid output format.</p>
                )}
              </div>
            )}
            <p className="mt-4 text-lg text-gray-700">
              Status: {prediction.status}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
