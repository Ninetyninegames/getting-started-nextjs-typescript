import JSZip from "jszip";

/**
 * Extracts the .glb file from a given .zip file URL.
 * @param {string} zipUrl - The URL of the .zip file to extract.
 * @returns {Promise<string>} - A promise that resolves to the URL of the extracted .glb file.
 */
export async function extractZipFile(zipUrl: string): Promise<string> {
    const response = await fetch(zipUrl);
    const blob = await response.blob();
    const zip = await JSZip.loadAsync(blob);
    let glbUrl = '';

    await Promise.all(
        Object.keys(zip.files).map(async (relativePath: string) => {
            const file = zip.files[relativePath];
            if (relativePath.endsWith(".glb")) {
                const glbBlob = await file.async("blob"); // Convert JSZipObject to Blob
                glbUrl = URL.createObjectURL(glbBlob); // Create a URL for the Blob
            }
        })
    );

    if (!glbUrl) {
        throw new Error("No .glb file found in the .zip archive.");
    }

    return glbUrl;
}
