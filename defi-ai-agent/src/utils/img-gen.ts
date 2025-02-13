import { venice } from '@/lib/constants';
import { uploadImageToIPFS } from '@/lib/filebase';
import axios from 'axios';
export const generateImage = async (): Promise<string | null> => {
    const apiUrl = venice.baseUrl;
    const apiKey = venice.apiKey;

    if (!apiKey || !apiUrl) {
        console.error("Error: VENICE_KEY is not set.");
        return null;
    }

    const requestBody = {
        model_name: "SDXL1.0-base",
        prompt: "a photo of an astronaut riding a horse on mars",
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

        if (!response.data.images || !response.data.images[0]?.url) {
            console.error("Error: Invalid response from API", response.data);
            return null;
        }

        const imageUrl = response.data.images[0].url;
        console.log("Generated Image URL:", imageUrl);
        return uploadImageToIPFS(imageUrl);
    } catch (error) {
        console.error("Error generating image:", error);
        return null;
    }
};