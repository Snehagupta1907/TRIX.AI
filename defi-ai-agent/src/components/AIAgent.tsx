"use client"
import React, { useState, KeyboardEvent } from 'react';
import { useAccount } from 'wagmi';
import { Loader, BrainCircuit, ArrowRightLeft, PiggyBank, LineChart, Send, Rocket } from 'lucide-react';
import ResponseDisplay from './ResponseDisplay';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TabType = 'general'|'swap' | 'lend' | 'trade';
type Chain = 'arbitrum' | 'optimism' | 'base' | 'ethereum';

export default function AIAgent() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [userInput, setUserInput] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [selectedChain, setSelectedChain] = useState<Chain>('arbitrum');
  const [error, setError] = useState('');
  
  const { isConnected } = useAccount();


  React.useEffect(() => {
    if (!isConnected && activeTab !== 'general') {
      setActiveTab('general');
    }
  }, [isConnected, activeTab]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim()) return;
    
    setError('');
    setLoading(true);
    
    setMessages(prev => [...prev, { role: 'user', content: userInput }]);
    const currentInput = userInput;
    setUserInput('');

    try {
      const response = await fetch('/api/ai-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: currentInput,
          action: activeTab,
          chain: selectedChain,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.data }]);
    } catch (err) {
      setError('Failed to process request. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <BrainCircuit size={20} /> },
    { id: 'swap', label: 'Swap', icon: <ArrowRightLeft size={20} /> },
    { id: 'lend', label: 'Lending', icon: <PiggyBank size={20} /> },
    { id: 'trade', label: 'Trading', icon: <LineChart size={20} /> },
  ];

  // Filter tabs based on wallet connection
  const visibleTabs = isConnected ? tabs : tabs.filter(tab => tab.id === 'general');

  const chains = [
    { id: 'arbitrum', label: 'Arbitrum' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
      {/* Sidebar */}
      <div className="w-64 bg-black/40 backdrop-blur-xl p-4 flex flex-col border-r border-purple-500/10">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 flex items-center gap-2 mb-2">
            <Rocket className="text-purple-500" size={24} />
            Trix
          </h1>
          <ConnectButton />
        </div>

        {/* Chain Selection - Only show when wallet is connected */}
        {isConnected && (
          <div className="my-6">
            <label className="block text-sm font-medium text-purple-300 mb-2">
              Select Chain
            </label>
            <Select
              value={selectedChain}
              onValueChange={(value: Chain) => setSelectedChain(value)}
            >
              <SelectTrigger className="w-full bg-black/50 text-white border-purple-500/20">
                <SelectValue placeholder="Select chain" />
              </SelectTrigger>
              <SelectContent>
                {chains.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id}>
                    {chain.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Tab Selection */}
        <div className="space-y-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/20'
                  : 'text-purple-300 hover:bg-purple-500/10'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Messages Display */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'assistant' 
                  ? 'bg-black/40 backdrop-blur-sm border border-purple-500/10' 
                  : 'bg-purple-500/10 backdrop-blur-sm'
              } p-4 rounded-lg`}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4">
                {message.role === 'assistant' ? (
                  <BrainCircuit className="text-purple-400" />
                ) : (
                  <div className="bg-gradient-to-r from-purple-400 to-pink-600 rounded-full w-8 h-8" />
                )}
              </div>
              <div className="flex-1">
                <ResponseDisplay response={message.content} type={activeTab} />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center justify-center">
              <Loader className="animate-spin text-purple-500" size={24} />
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="border-t border-purple-500/10 p-4 bg-black/40 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="flex items-end gap-4">
            <div className="flex-1">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !isConnected
                    ? "Connect your wallet to access DeFi features, or ask general questions"
                    : activeTab === 'swap'
                    ? "e.g., 'Swap 0.1 ETH to USDC with best rate'"
                    : activeTab === 'lend'
                    ? "e.g., 'Find best lending rates for ETH'"
                    : activeTab === 'trade'
                    ? "e.g., 'Analyze ETH/USDC trading opportunities'"
                    : "How can I help you with your DeFi needs?"
                }
                className="w-full h-24 bg-black/50 border border-purple-500/20 rounded-lg p-4 text-purple-100 placeholder-purple-500/50 focus:ring-2 focus:ring-purple-500/50 focus:border-transparent resize-none"
              />
              {error && (
                <div className="text-red-400 text-sm mt-2">{error}</div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || (!isConnected && activeTab !== 'general') || !userInput.trim()}
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white p-4 rounded-lg flex items-center justify-center transition-all duration-200 mb-2"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}