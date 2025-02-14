/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

interface ResponseDisplayProps {
  response: any;
  type: 'swap' | 'lend' | 'trade' | 'general' | 'mint';
}

export default function ResponseDisplay({ response, type }: ResponseDisplayProps) {
  if (!response) return null;

  // If the response includes an image, show it along with its text.
  if (response.imageSrc) {
    return (
      <div className="flex flex-col items-center">
        <p className="text-purple-300 text-center">{response.text}</p>
        <img src={response.imageSrc} alt="Generated NFT" className="w-32 h-32 mt-2 rounded-lg shadow-lg" />
        <p className="text-purple-300 mt-2">Do you want to mint this image as an NFT?</p>
      </div>
    );
  }

  // For swap type responses formatted as objects, we still use the card layout.
  if (type === 'swap' && typeof response === 'object') {
    return (
      <div className="text-purple-100 space-y-4 p-4 bg-gray-800 rounded-lg shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-purple-400 font-semibold">From:</span>
          <span className="text-green-400">{response.fromToken}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-purple-400 font-semibold">To:</span>
          <span className="text-green-400">{response.toToken}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-purple-400 font-semibold">Amount:</span>
          <span className="text-green-400">{response.amount}</span>
        </div>
        {response.chain && (
          <div className="flex items-center gap-2">
            <span className="text-purple-400 font-semibold">Chain:</span>
            <span className="text-green-400">{response.chain}</span>
          </div>
        )}
      </div>
    );
  }

  // For all other responses, we assume the response is a markdown-formatted string.
  // Using react-markdown provides a better UI with default styles from Tailwind Typography.
  return (
    <div className="text-purple-100 p-4 bg-gray-800 rounded-lg shadow-md">
      <ReactMarkdown
        className="prose prose-invert max-w-none"
        rehypePlugins={[rehypeRaw]}
      >
        {typeof response === 'string' ? response : JSON.stringify(response, null, 2)}
      </ReactMarkdown>
    </div>
  );
}
