/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { uploadImageToIPFS } from '@/lib/filebase';
import axios from 'axios';

export const generateImage = async (prompt: string): Promise<string | null> => {
    const apiUrl = process.env.VENICE_API_BASE_URL;
    const apiKey = process.env.VENICE_API_KEY; // Secure API Key Handling

    if (!apiKey || !apiUrl) {
        console.error("Error: API key or URL is missing.");
        throw new Error("Venice api key or URL is missing.");
    }

    const requestBody = {
        model_name: "SDXL1.0-base",
        prompt: prompt,
        height: 1024,
        width: 1024,
        backend: "auto"
    };

    try {
        const response = await axios.post(apiUrl, requestBody, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            }
        });

        console.log("API Response:", response.data);

        if (!response.data?.images || !response.data.images[0]?.image) {
            console.error("Error: No valid image data received from API", response.data);
            return null;
        }

        const base64Image = response.data.images[0].image;

        // Convert Base64 to Buffer
        const imageBuffer = Buffer.from(base64Image, 'base64');

        // Upload the image buffer to IPFS
        const ipfsUrl = await uploadImageToIPFS(imageBuffer);
        const nftObj={
            name: "AI-NFT",
            image: ipfsUrl,
            attributes: [{
                "trait_type": "type",
                "value": "Ai Minted NFT"
            }]
        }
        // Upload the NFT object to IPFS
        console.log("NFT Object:", nftObj);
        const nftObjBuffer = JSON.stringify(nftObj);
        const nftIpfsUrl = await uploadImageToIPFS(nftObjBuffer);
        return nftIpfsUrl;
    } catch (error: any) {
        console.error("Error generating image:", error.response?.data || error.message);
        throw error
    }
};
