"use client";

import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Prediction {
  id: string;
  status: string;
  output: string[];
  detail?: string;
}

const funFacts = [
  "Did you know? 3D models consist of polygons, and the more polygons, the more detailed the model!",
  "Pro Tip: Using negative prompts can help you refine your model generation.",
  // Additional fun facts...
];

const getRandomFact = () => funFacts[Math.floor(Math.random() * funFacts.length)];

const LoadingAnimation = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(150, 150);

    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xfdbf54 });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    camera.position.z = 5;

    const animate = () => {
      requestAnimationFrame(animate);
      sphere.rotation.x += 0.01;
      sphere.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={mountRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
  );
};

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
      if (url.endsWith(".obj")) {
        loader = new OBJLoader();
      } else {
        console.error("Unsupported file format:", url);
        return;
      }

      if (loader) {
        loader.load(
          url,
          (object) => {
            scene.add(object);
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
      style={{
        width: "100%",
        height: "500px",
        borderRadius: "15px",
        boxShadow: "0 10px 20px rgba(0,0,0,0.5)",
      }}
    />
  );
};

export default function Home() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelType, setModelType] = useState<string>("generate_glb_mesh");
  const [imageType, setImageType] = useState<string>("upload");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [funFact, setFunFact] = useState<string>(getRandomFact);
  const [loadingMessage, setLoadingMessage] = useState<string>("Creating");

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingMessage((prev) =>
          prev.length < 12 ? prev + "." : "Creating"
        );
      }, 500);

      return () => clearInterval(interval);
    }
  }, [isLoading]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError(null);
    setIsLoading(true);
    setFunFact(getRandomFact());

    const formData = new FormData(e.currentTarget);
    formData.append("model_type", modelType);

    // Default values for additional parameters (specific to GLB Mesh)
    formData.append("remove_background", "true");
    formData.append("export_video", "true");
    formData.append("export_texmap", "true");
    formData.append("sample_steps", "75");
    formData.append("seed", "42");

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

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      while (prediction.status !== "succeeded" && prediction.status !== "failed") {
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
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-black">
      <Head>
        <title>Ninety Nine 3D Asset Generator</title>
      </Head>

      <div className="flex flex-col z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex bg-gray-900 p-10 border border-orange-500 rounded-xl shadow-2xl">
        <p className="mb-4 text-lg text-gray-300 font-bold">
          {modelType === "generate_glb_mesh" ? "Create GLB Mesh:" : "Create PLY Models:"}
        </p>

        <select
          value={modelType}
          onChange={(e) => setModelType(e.target.value)}
          className="mb-4 px-4 py-2 w-full bg-gray-800 border border-orange-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="generate_glb_mesh">Create GLB Mesh</option>
          <option value="ply">Create Poly (PLY)</option>
        </select>

        <form onSubmit={handleSubmit} className="flex flex-col items-center w-full" encType="multipart/form-data">
          {modelType === "generate_glb_mesh" && (
            <>
              <select
                value={imageType}
                onChange={(e) => setImageType(e.target.value)}
                className="mb-4 px-4 py-2 w-full bg-gray-800 border border-orange-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="upload">Upload Image</option>
                <option value="url">Image URL</option>
              </select>

              {imageType === "upload" ? (
                <input
                  type="file"
                  name="image_path"
                  accept=".png,.jpg,.jpeg"
                  required
                  className="px-4 py-2 w-full bg-gray-800 text-white border border-orange-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mt-2"
                />
              ) : (
                <input
                  type="text"
                  name="image_path"
                  placeholder="Enter Image URL"
                  required
                  className="px-4 py-2 w-full bg-gray-800 text-white border border-orange-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mt-2"
                />
              )}
            </>
          )}

          {modelType === "ply" && (
            <input
              type="text"
              name="ply_prompt"
              placeholder="Enter a description for the PLY model"
              required
              className="px-4 py-2 w-full bg-gray-800 text-white border border-orange-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          )}

          <button
            type="submit"
            className={`px-4 py-2 mt-4 w-full bg-orange-500 text-white rounded-lg shadow-xl ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-orange-400"
              }`}
            disabled={isLoading}
          >
            {isLoading ? "Generating..." : modelType === "ply" ? "Generate PLY" : "Create GLB Mesh"}
          </button>
        </form>

        {error && <div className="mt-4 text-red-500">{error}</div>}

        {isLoading && (
          <div className="mt-4 w-full flex flex-col items-center">
            <p className="text-lg text-gray-300">{funFact}</p>
            <LoadingAnimation />
            <p className="text-lg text-orange-500 mt-4">{loadingMessage}</p>
          </div>
        )}

        {prediction && (
          <div className="mt-4 w-full">
            {prediction.output && prediction.output[0] && (
              <div className="flex flex-col items-center justify-center w-full">
                {(prediction.output[0].endsWith(".glb") || prediction.output[0].endsWith(".ply")) ? (
                  <Your3DViewerComponent url={prediction.output[0]} />
                ) : (
                  <p className="text-red-500">Invalid output format.</p>
                )}
              </div>
            )}
            <p className="mt-4 text-lg text-gray-300">
              Status: {prediction.status}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
