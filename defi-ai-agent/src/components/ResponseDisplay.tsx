/* eslint-disable @typescript-eslint/no-explicit-any */
// components/ResponseDisplay.tsx
import React from 'react';

interface ResponseDisplayProps {
  response: any;
  type: 'swap' | 'lend' | 'trade' | 'general' | 'mint';
}

export default function ResponseDisplay({ response, type }: ResponseDisplayProps) {
  if (!response) return null;

  const formatResponse = (content: any) => {
    if (typeof content === 'object') {
      return JSON.stringify(content, null, 2);
    }
    // Handle markdown-style code blocks
    return content.replace(
      /```([\s\S]*?)```/g,
      '<pre class="bg-black/40 p-2 rounded-lg my-2 font-mono text-purple-300">$1</pre>'
    );
  };

  return (
    <div className="text-purple-100">
      {type === 'swap' && typeof response === 'object' ? (
        <div className="space-y-2 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-purple-400">From:</span>
            <span className="text-green-400">{response.fromToken}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-purple-400">To:</span>
            <span className="text-green-400">{response.toToken}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-purple-400">Amount:</span>
            <span className="text-green-400">{response.amount}</span>
          </div>
          {response.chain && (
            <div className="flex items-center gap-2">
              <span className="text-purple-400">Chain:</span>
              <span className="text-green-400">{response.chain}</span>
            </div>
          )}
        </div>
      ) : (
        <div 
          className="prose prose-invert max-w-none prose-pre:bg-black/40 prose-pre:border prose-pre:border-purple-500/20"
          dangerouslySetInnerHTML={{ 
            __html: formatResponse(response)
          }}
        />
      )}
    </div>
  );
}