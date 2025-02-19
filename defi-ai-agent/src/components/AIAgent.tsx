"use client";
import React, { useState, KeyboardEvent } from "react";
import { useAccount } from "wagmi";
import {
  PiggyBank,
  LineChart,
  Send,
  ImagePlay,
  Loader, 
  BrainCircuit,
  RefreshCw,
  Sparkles,
  ArrowRightLeft,
  User,
  Bot
} from "lucide-react";
import ResponseDisplay from "./ResponseDisplay";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateImage } from "@/utils/img-gen";
import { formatNftPrompt } from "@/utils/prompt";
import { CustomConnect } from "./CustomConnect";

type TabType = "general" | "swap" | "lend" | "trade" | "mint";
type Chain = "arbitrum" | "optimism" | "base" | "ethereum";

export default function AIAgent() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      role: "user" | "assistant";
      content: string | React.JSX.Element | object;
    }>
  >([]);

  const [userInput, setUserInput] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [selectedChain, setSelectedChain] = useState<Chain>("arbitrum");
  const [error, setError] = useState("");
  // NEW: State to hold the NFT data waiting for confirmation
  const [pendingNFT, setPendingNFT] = useState<{ nftIpfsUrl: string } | null>(
    null
  );
  type SwapStep =
    | "SETUP_CONFIRMATION"
    | "AWAIT_DEPOSIT_APPROVAL"
    | "AWAIT_SWAP_DETAILS"
    | "CONFIRM_SWAP"
    | "AWAIT_AMOUNT"
    | "AWAIT_BUY_TOKEN"
    | "AWAIT_SELL_TOKEN"
    | "AWAIT_PRIVATE_KEY";

  interface SwapDetails {
    inputAmt?: string;
    sellAddress?: string;
    buyAddress?: string;
    sellToken?: string;
    buyToken?: string;
  }

  interface PendingSwap {
    step: SwapStep;
    details?: SwapDetails;
  }

  // State definitions
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [pendingSwap, setPendingSwap] = useState<PendingSwap | null>(null);

  const { isConnected, address } = useAccount();
  const [privateKey, setPrivateKey] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isConnected && activeTab !== "general") {
      setActiveTab("general");
    }
  }, [isConnected, activeTab]);

  // Helper function to check for confirmation phrases
  const isConfirmation = (text: string) => {
    const confirmations = [
      "yes",
      "sure",
      "why not",
      "go ahead",
      "mint",
      "confirm",
    ];
    return confirmations.some((phrase) => text.toLowerCase().includes(phrase));
  };

  console.log(pendingSwap, safeAddress, privateKey);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim()) return;
    setError("");
    setLoading(true);

    // Append the user's message to the conversation
    const currentInput = userInput;
    console.log(currentInput);
    setMessages((prev) => [...prev, { role: "user", content: currentInput }]);
    setUserInput("");

    try {
      let response;

      switch (activeTab) {
        case "mint":
          if (!address) {
            setError("Wallet must be connected to mint an NFT.");
            setLoading(false);
            return;
          }

          // If we already generated an NFT and are waiting for confirmation…
          if (pendingNFT) {
            if (isConfirmation(currentInput)) {
              // User confirmed; proceed with minting the NFT
              const requestBody = {
                WALLET_ADDRESS: address,
                TOKEN_URI: pendingNFT.nftIpfsUrl,
              };
              response = await fetch("/api/nft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
              });
              // Clear the pending NFT after minting
              setPendingNFT(null);
            } else {
              // No confirmation detected: cancel minting
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content:
                    "Minting cancelled. If you want to mint, please generate a new NFT image.",
                },
              ]);
              setPendingNFT(null);
              setLoading(false);
              return;
            }
          } else {
            // No pending NFT – generate the NFT image and ask for confirmation
            const tokenUri = await generateImage(formatNftPrompt(currentInput));
            console.log(tokenUri);
            if (tokenUri?.nftIpfsUrl) {
              setPendingNFT({ nftIpfsUrl: tokenUri.nftIpfsUrl });
            } else {
              setError("Error generating NFT image.");
              setLoading(false);
              return;
            }

            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: {
                  text: "Here is your generated image:",
                  imageSrc: tokenUri?.img, // Store the image URL separately
                },
              },
            ]);
            setLoading(false);
            return; // wait for the user's confirmation response
          }
          break;

        case "swap": {
          try {
            // New user without Safe - Initial interaction
            if (!privateKey) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content:
                    "To proceed with the swap, I'll need your private key. Please enter it now:",
                },
              ]);
              setPendingSwap({ step: "AWAIT_PRIVATE_KEY" });
              return;
            }

            // Handle private key input
            if (pendingSwap?.step === "AWAIT_PRIVATE_KEY") {
              const inputKey = currentInput.trim();
              console.log("Input Private Key:", inputKey);

              setPrivateKey(inputKey);

              // Ensure state has updated before proceeding
              setTimeout(() => {
                if (!safeAddress) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content:
                        "I notice you want to swap tokens! You'll need a Safe wallet first. Would you like me to set one up for you?",
                    },
                  ]);
                  setPendingSwap({ step: "SETUP_CONFIRMATION" });
                }
              }, 100); // Adjust timeout as needed
            }

            if (!safeAddress && !pendingSwap) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content:
                    "I notice you want to swap tokens! You'll need a Safe wallet first. Would you like me to set one up for you?",
                },
              ]);

              setPendingSwap({ step: "SETUP_CONFIRMATION" });
              return;
            }

            // User confirmed Safe setup
            if (
              !safeAddress &&
              pendingSwap?.step === "SETUP_CONFIRMATION" &&
              isConfirmation(currentInput)
            ) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: "Creating your Safe wallet now...",
                },
              ]);

              const safeResponse = await fetch("/api/setup-safe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  SIGNER_PRIVATE_KEY: privateKey,
                }),
              });

              if (safeResponse.status === 500) {
                const err = await safeResponse.json();
                console.log({ err });
                throw new Error(err?.details || "Error creating");
              }

              const { safeAddress: newSafeAddress } = await safeResponse.json();
              setSafeAddress(newSafeAddress);

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Great! I've created your Safe wallet at ${newSafeAddress}. Before we can swap, we need to deposit some ETH and approve it for trading. Should I proceed with that?`,
                },
              ]);

              setPendingSwap({ step: "AWAIT_DEPOSIT_APPROVAL" });
              return;
            }

            // User confirmed deposit and approve
            if (
              pendingSwap?.step === "AWAIT_DEPOSIT_APPROVAL" &&
              isConfirmation(currentInput)
            ) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: "Processing deposit and approval...",
                },
              ]);

              const approveResponse = await fetch("/api/deposit-approve-cow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  SAFE_ADDRESS: safeAddress,
                  SIGNER_PRIVATE_KEY: privateKey,
                }),
              });

              if (!approveResponse.ok)
                throw new Error("Failed to execute deposit and approval");

              const { transactionHash, wethBalance, ethBalance } =
                await approveResponse.json();

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Perfect! The deposit and approval are complete (tx: ${transactionHash}). Your balances are: ${ethBalance} ETH and ${wethBalance} WETH. Which token would you like to swap from? (e.g., WETH)`,
                },
              ]);

              setPendingSwap({
                step: "AWAIT_SELL_TOKEN",
                details: {},
              });
              return;
            }

            // User provided sell token
            if (pendingSwap?.step === "AWAIT_SELL_TOKEN") {
              const sellToken = currentInput.trim();

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Got it, you want to swap from ${sellToken}. Which token would you like to swap to?`,
                },
              ]);

              setPendingSwap({
                step: "AWAIT_BUY_TOKEN",
                details: {
                  ...pendingSwap.details,
                  sellToken,
                },
              });
              return;
            }

            // User provided buy token
            if (pendingSwap?.step === "AWAIT_BUY_TOKEN") {
              const buyToken = currentInput.trim();

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Great, you want to swap from ${pendingSwap?.details?.sellToken} to ${buyToken}. How much ${pendingSwap?.details?.sellToken} would you like to swap? (Enter amount)`,
                },
              ]);

              setPendingSwap({
                step: "AWAIT_AMOUNT",
                details: {
                  ...pendingSwap.details,
                  buyToken,
                },
              });
              return;
            }

            // User provided amount
            if (pendingSwap?.step === "AWAIT_AMOUNT") {
              const amount = currentInput.trim();
              const { sellToken, buyToken } = pendingSwap?.details || {};

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `To confirm: You want to swap ${amount} ${sellToken} for ${buyToken}. Would you like to proceed with the swap?`,
                },
              ]);

              setPendingSwap({
                step: "CONFIRM_SWAP",
                details: {
                  inputAmt: amount,
                  sellAddress: sellToken, // You'll need to define these addresses
                  buyAddress: buyToken,
                },
              });
              return;
            }

            // Execute final swap
            if (
              pendingSwap?.step === "CONFIRM_SWAP" &&
              isConfirmation(currentInput)
            ) {
              const { details } = pendingSwap;

              console.log(safeAddress, privateKey, details);

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: "Executing your swap...",
                },
              ]);

              const swapResponse = await fetch("/api/swap-cow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  SAFE_ADDRESS: safeAddress,
                  SIGNER_PRIVATE_KEY: privateKey,
                  buyAddress: details?.buyAddress,
                  sellAddress: details?.sellAddress,
                  inputAmt: details?.inputAmt,
                }),
              });

              if (!swapResponse.ok) throw new Error("Failed to execute swap");

              const { transactionHash } = await swapResponse.json();

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Great news! Your swap is complete. You can view the transaction here: ${transactionHash}`,
                },
              ]);

              setPendingSwap(null);
            }
          } catch (error) {
            console.error("Swap error:", error);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `I apologize, but there was an error: ${error instanceof Error ? error.message : 'Unknown error'}. Would you like to try again?`,
              },
            ]);
            if (error instanceof Error) {
              setError(error.message);
            } else {
              setError("An unknown error occurred.");
            }
            setPendingSwap(null);
          } finally {
            setLoading(false);
          }
          break;
        }

        case "lend":
          response = await fetch("/api/lending", {
            method: "GET",
          });
          break;

        case "trade":
          response = await fetch("/api/trade", {
            method: "GET",
          });
          break;

        case "general":
        default:
          response = await fetch("/api/general", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: currentInput }),
          });
          break;
      }

      const data = await response?.json();
      console.log({ data });

      if (data.error) {
        setError(data.error);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error}` },
        ]);
        return;
      }

      // For minting, you might want to extract and show the transaction link from data.data
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.data },
      ]);
    } catch (err) {
      setError("Failed to process request. Please try again.");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <BrainCircuit size={20} /> },
    { id: "swap", label: "Swap", icon: <ArrowRightLeft size={20} /> },
    { id: "lend", label: "Lending", icon: <PiggyBank size={20} /> },
    { id: "trade", label: "Trading", icon: <LineChart size={20} /> },
    { id: "mint", label: "Mint", icon: <ImagePlay size={20} /> },
  ];

  const visibleTabs = isConnected
    ? tabs
    : tabs.filter((tab) => tab.id === "general");

  const chains = [
    { id: "arbitrum", label: "Arbitrum" },
    { id: "mantle-sepolia", label: "Mantle Sepolia" },
  ];

  const StarField = () => {
    return (
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0a0a0a] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              opacity: Math.random() * 0.7,
              animation: `twinkle ${Math.random() * 5 + 5}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen relative overflow-hidden font-sans">
      <StarField />
      
      {/* Sidebar with glass morphism */}
      <div className="w-72 bg-black/40 backdrop-blur-xl p-6 flex flex-col border-r border-gray-500/20 z-10 shadow-xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400 flex items-center gap-3 mb-4">
            <Bot className="text-gray-100" size={28} />
            Trix AI
          </h1>
          <div className="transform transition-all duration-300 hover:scale-105">
            <CustomConnect />
          </div>
        </div>

        {isConnected && (
          <div className="my-6 bg-gray-900/10 p-4 rounded-xl border border-gray-500/20">
            <label className="block text-sm font-medium text-gray-300 mb-2">
             Choose Network
            </label>
            <Select
              value={selectedChain}
              onValueChange={(value: Chain) => setSelectedChain(value)}
            >
              <SelectTrigger className="w-full bg-black/50 text-white border-gray-500/20">
                <SelectValue placeholder="Select chain" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-500/20">
                {chains.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id} className="text-gray-100">
                    {chain.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2 flex-1">
          <h3 className="text-xs uppercase text-gray-400/70 mb-3 font-semibold tracking-wider">Features</h3>
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-gray-500/20 to-black/20 text-white border border-gray-500/20 shadow-lg shadow-gray-500/5"
                  : "text-gray-300 hover:bg-gray-500/10"
              }`}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
        
        <div className="mt-auto pt-4 border-t border-gray-500/10 text-xs text-gray-400/60 flex items-center gap-2">
          <RefreshCw size={12} />
          <span>Updated Feb 19, 2025</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-black/60 to-gray-900/10 backdrop-blur-md">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="rounded-full bg-gray-500/10 p-6 mb-6">
              <BrainCircuit className="text-gray-400" size={48} />
            </div>
            <h2 className="text-2xl font-semibold text-gray-100 mb-3">Trix AI Assistant</h2>
            <p className="text-gray-300 text-center max-w-md mb-8">
              Your personal crypto and DeFi guide. Ask me anything about tokens, trading, NFTs, or general questions.
            </p>
            <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
              {["Tell me about DeFi yield strategies", "How to swap ETH to USDC efficiently?", 
                "Generate an NFT with cosmic theme", "Analyze ETH price trend"].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setUserInput(suggestion);
                  }}
                  className="bg-gray-500/10 hover:bg-gray-500/20 text-gray-200 p-4 rounded-xl border border-gray-500/10 text-left transition-all duration-200 hover:border-gray-500/30"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-500/20">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex max-w-5xl mx-auto ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`flex max-w-4xl ${
                    message.role === "assistant"
                      ? "bg-[#212121] backdrop-blur-sm border border-gray-500/10"
                      : "bg-gray-700 text-black backdrop-blur-sm"
                  } p-5 rounded-2xl ${message.role === "assistant" ? "rounded-tl-sm" : "rounded-tr-sm"} shadow-lg transition-all duration-500 hover:shadow-gray-500/10`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 flex-shrink-0 ${
                    message.role === "assistant" 
                      ? "bg-gradient-to-r from-indigo-500 to-gray-600"
                      : "bg-gradient-to-r from-pink-300 to-gray-500"
                  }`}>
                    {message.role === "assistant" ? (
                      <BrainCircuit className="text-white" size={18} />
                    ) : (
                      <User className="text-white" size={18} />
                    )}
                  </div>
                  <div className="flex-1 w-full">
                    <ResponseDisplay response={message.content}  />
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex max-w-4xl mx-auto">
                <div className="flex max-w-xl bg-[#212121] backdrop-blur-sm border border-gray-500/10 p-5 rounded-2xl rounded-tl-sm">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-gray-600 flex items-center justify-center mr-4 flex-shrink-0">
                    <BrainCircuit className="text-white" size={18} />
                  </div>
                  <ResponseDisplay 
                    response={null} 
                  
                    isLoading={true} 
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-gray-500/10 p-6 bg-black/60 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="flex items-end gap-4 max-w-5xl mx-auto relative">
            <div className="flex-1 relative">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !isConnected
                    ? "Connect your wallet or ask general questions..."
                    : activeTab === "swap"
                    ? "e.g., 'Swap 0.1 ETH to USDC with best rate'"
                    : activeTab === "lend"
                    ? "e.g., 'Find best lending rates for ETH'"
                    : activeTab === "trade"
                    ? "e.g., 'Analyze ETH/USDC trading opportunities'"
                    : activeTab === "mint"
                    ? "e.g., 'Create cosmic galaxy NFT with gray theme'"
                    : "Ask me anything..."
                }
                className="w-full bg-black/50 border border-gray-500/20 rounded-2xl p-4 pb-12 text-gray-100 placeholder-gray-500/50 focus:ring-2 focus:ring-gray-500/50 focus:border-transparent resize-none h-24 transition-all duration-200 focus:shadow-lg focus:shadow-gray-500/10"
              />
              {error && (
                <div className="absolute bottom-3 left-4 text-red-400 text-sm">{error}</div>
              )}
              
              {messages.length > 0 && !loading && (
                <div className="absolute bottom-3 left-4 text-gray-400/70 text-xs flex items-center gap-1">
                  <Sparkles size={12} />
                  <span>Trix is ready to assist</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={
                loading ||
                (!isConnected && activeTab !== "general") ||
                !userInput.trim()
              }
              className="bg-gradient-to-r from-gray-500 to-white hover:from-gray-600 hover:to-gray-400 disabled:from-gray-600 disabled:to-gray-700 text-white p-4 rounded-xl flex items-center justify-center transition-all duration-300 hover:shadow-lg hover:shadow-gray-500/20 disabled:shadow-none h-12 w-12 mb-2"
            >
              {loading ? <Loader size={20} className="animate-spin" /> : <Send size={18} color="black" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
